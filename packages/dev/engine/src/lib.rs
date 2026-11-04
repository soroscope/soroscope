//! In-process Soroban execution for `@soroscope/dev`.
//!
//! A contract runs inside `soroban-env-host` (the same host stellar-core uses)
//! against an in-memory ledger owned by this process. There is no network, no
//! Docker and no signing. Each call goes through `soroban-simulation`, the
//! code path Stellar RPC's `simulateTransaction` uses, so the instructions,
//! footprint, auth and resource fee reported here are computed the way the
//! network computes them, from the network's own recorded configuration.
//!
//! The JS boundary speaks base64 XDR. `invoke` returns JSON shaped like an RPC
//! `simulateTransaction` response so `@soroscope/core` decodes it unchanged.

use std::collections::BTreeMap;
use std::rc::Rc;

use napi::bindgen_prelude::Buffer;
use napi::{Error, Result, Status};
use napi_derive::napi;
use sha2::{Digest, Sha256};
use soroban_env_host::e2e_invoke::RecordingInvocationAuthMode;
use soroban_env_host::storage::{EntryWithLiveUntil, SnapshotSource};
use soroban_env_host::xdr::{
    AccountEntry, AccountEntryExt, AccountId, ContractCostType, ContractDataDurability, ContractExecutable,
    ContractId, ContractIdPreimage, ContractIdPreimageFromAddress, CreateContractArgsV2, Hash,
    HostFunction, InvokeContractArgs, LedgerEntry, LedgerEntryData, LedgerEntryExt, LedgerKey,
    LedgerKeyAccount, LedgerKeyConfigSetting, LedgerKeyContractCode, LedgerKeyContractData,
    LedgerKeyTrustLine, Limits, PublicKey, ReadXdr,
    ScAddress, ScSymbol, ScVal, SequenceNumber, String32, Thresholds, Uint256, VecM, WriteXdr,
};
use soroban_env_host::{HostError, LedgerInfo};
use soroban_simulation::simulation::{
    simulate_invoke_host_function_op, InvokeHostFunctionSimulationResult,
    SimulationAdjustmentConfig,
};
use soroban_simulation::NetworkConfig;

/// The newest protocol this build of the host can run. A host executes
/// contracts built for the same or an older protocol, so a network ahead of it
/// would fail with an opaque `contract protocol number is newer than host`.
#[napi]
pub fn host_protocol_version() -> u32 {
    soroban_env_host::meta::INTERFACE_VERSION.protocol
}

fn err(msg: impl std::fmt::Display) -> Error {
    Error::new(Status::GenericFailure, msg.to_string())
}

fn b64<T: WriteXdr>(v: &T) -> Result<String> {
    v.to_xdr_base64(Limits::none()).map_err(err)
}

fn from_b64<T: ReadXdr>(s: &str, what: &str) -> Result<T> {
    T::from_xdr_base64(s, Limits::none()).map_err(|e| err(format!("invalid {what} XDR: {e}")))
}

fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

/// The key a ledger entry is stored under. Only the entry types Soroban
/// execution touches are supported.
fn key_of(entry: &LedgerEntry) -> Result<LedgerKey> {
    Ok(match &entry.data {
        LedgerEntryData::Account(a) => {
            LedgerKey::Account(LedgerKeyAccount { account_id: a.account_id.clone() })
        }
        LedgerEntryData::Trustline(t) => LedgerKey::Trustline(LedgerKeyTrustLine {
            account_id: t.account_id.clone(),
            asset: t.asset.clone(),
        }),
        LedgerEntryData::ContractData(d) => LedgerKey::ContractData(LedgerKeyContractData {
            contract: d.contract.clone(),
            key: d.key.clone(),
            durability: d.durability,
        }),
        LedgerEntryData::ContractCode(c) => {
            LedgerKey::ContractCode(LedgerKeyContractCode { hash: c.hash.clone() })
        }
        LedgerEntryData::ConfigSetting(c) => LedgerKey::ConfigSetting(LedgerKeyConfigSetting {
            config_setting_id: c.discriminant(),
        }),
        other => return Err(err(format!("unsupported ledger entry type {:?}", other.discriminant()))),
    })
}

/// The in-memory ledger. A snapshot of it is handed to the host per call.
#[derive(Clone, Default)]
struct Ledger(BTreeMap<Rc<LedgerKey>, EntryWithLiveUntil>);

impl SnapshotSource for Ledger {
    fn get(&self, key: &Rc<LedgerKey>) -> std::result::Result<Option<EntryWithLiveUntil>, HostError> {
        Ok(self.0.get(key).cloned())
    }
}

/// One network config setting as `getLedgerEntries` returns it.
#[napi(object)]
pub struct ConfigEntryInput {
    /// Base64 `LedgerEntryData` XDR.
    pub xdr: String,
    pub last_modified_ledger_seq: u32,
}

#[napi(object)]
pub struct EngineOptions {
    pub network_passphrase: String,
    pub protocol_version: u32,
    /// Ledger sequence the local ledger starts at.
    pub sequence: u32,
    /// Unix seconds the local ledger starts at.
    pub timestamp: i64,
    /// Every CONFIG_SETTING entry of the network to emulate (fee rates, cost model, TTL limits).
    pub config_entries: Vec<ConfigEntryInput>,
}

#[napi(object)]
pub struct DeployResult {
    /// `C...` strkey of the new contract.
    pub contract_id: String,
    /// Hex SHA-256 of the WASM.
    pub wasm_hash: String,
}

#[napi(object)]
pub struct SwapResult {
    pub contract_id: String,
    pub old_wasm_hash: String,
    pub new_wasm_hash: String,
}

#[napi]
pub struct Engine {
    ledger: Ledger,
    network_config: NetworkConfig,
    ledger_info: LedgerInfo,
    source: AccountId,
    nonce: u64,
}

#[napi]
impl Engine {
    #[napi(constructor)]
    pub fn new(options: EngineOptions) -> Result<Self> {
        // Defence in depth: the TypeScript layer raises a typed error first.
        if options.protocol_version > host_protocol_version() {
            return Err(err(format!(
                "network protocol {} is newer than the host this engine embeds ({})",
                options.protocol_version,
                host_protocol_version()
            )));
        }
        let mut ledger = Ledger::default();
        for c in &options.config_entries {
            let data: LedgerEntryData = from_b64(&c.xdr, "config LedgerEntryData")?;
            let entry = LedgerEntry {
                last_modified_ledger_seq: c.last_modified_ledger_seq,
                data,
                ext: LedgerEntryExt::V0,
            };
            ledger.0.insert(Rc::new(key_of(&entry)?), (Rc::new(entry), None));
        }
        let network_config = NetworkConfig::load_from_snapshot(&ledger)
            .map_err(|e| err(format!("network config incomplete: {e:#}")))?;
        // The host builds its budget from the network's cost model and needs one
        // entry per cost type it defines. A network on an older protocol than
        // the host has fewer (the host would fail with an opaque
        // `Error(Context, InternalError)` on the first call), so say so here.
        let defined = ContractCostType::VARIANTS.len();
        let recorded = network_config.cpu_cost_params.0.len();
        if recorded != defined || network_config.memory_cost_params.0.len() != defined {
            return Err(err(format!(
                "cost model mismatch: the network's configuration (protocol {}) has {} cost types, the embedded host (protocol {}) defines {}",
                options.protocol_version,
                recorded,
                host_protocol_version(),
                defined
            )));
        }
        let mut ledger_info = LedgerInfo {
            protocol_version: options.protocol_version,
            sequence_number: options.sequence,
            timestamp: u64::try_from(options.timestamp).map_err(err)?,
            network_id: sha256(options.network_passphrase.as_bytes()),
            base_reserve: 5_000_000,
            ..Default::default()
        };
        network_config.fill_config_fields_in_ledger_info(&mut ledger_info);

        // A local, never-signing source account, funded so contracts that read
        // it (or the native asset) behave as they would for a real deployer.
        let source = AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(sha256(
            b"soroscope-dev local source account",
        ))));
        let account = LedgerEntry {
            last_modified_ledger_seq: options.sequence,
            data: LedgerEntryData::Account(AccountEntry {
                account_id: source.clone(),
                balance: 10_000_000_000_000,
                seq_num: SequenceNumber(i64::from(options.sequence) << 32),
                num_sub_entries: 0,
                inflation_dest: None,
                flags: 0,
                home_domain: String32::default(),
                thresholds: Thresholds([1, 0, 0, 0]),
                signers: VecM::default(),
                ext: AccountEntryExt::V0,
            }),
            ext: LedgerEntryExt::V0,
        };
        ledger.0.insert(
            Rc::new(LedgerKey::Account(LedgerKeyAccount { account_id: source.clone() })),
            (Rc::new(account), None),
        );

        Ok(Self { ledger, network_config, ledger_info, source, nonce: 0 })
    }

    /// `G...` strkey of the local source account (the deployer and default invoker).
    #[napi(getter)]
    pub fn source_account(&self) -> String {
        let PublicKey::PublicKeyTypeEd25519(Uint256(k)) = &self.source.0;
        stellar_strkey::ed25519::PublicKey(*k).to_string()
    }

    #[napi(getter)]
    pub fn sequence(&self) -> u32 {
        self.ledger_info.sequence_number
    }

    /// Close `ledgers` empty ledgers, `seconds_per_ledger` apart. TTLs and
    /// timestamps seen by contracts move accordingly.
    #[napi]
    pub fn advance(&mut self, ledgers: u32, seconds_per_ledger: Option<u32>) {
        self.ledger_info.sequence_number += ledgers;
        self.ledger_info.timestamp += u64::from(ledgers) * u64::from(seconds_per_ledger.unwrap_or(5));
    }

    /// Install WASM code. Returns its hex hash.
    #[napi]
    pub fn upload_wasm(&mut self, wasm: Buffer) -> Result<String> {
        let sim = self.run(HostFunction::UploadContractWasm(wasm.to_vec().try_into().map_err(err)?))?;
        self.require_ok(&sim, "upload")?;
        self.commit(&sim)?;
        Ok(hex(&sha256(&wasm)))
    }

    /// Upload WASM and create a new contract from it, running its constructor
    /// with `constructor_args` (base64 `ScVal` each).
    #[napi]
    pub fn deploy(&mut self, wasm: Buffer, constructor_args: Option<Vec<String>>) -> Result<DeployResult> {
        let wasm_hash = self.upload_wasm(wasm)?;
        let args = constructor_args
            .unwrap_or_default()
            .iter()
            .map(|a| from_b64::<ScVal>(a, "constructor argument ScVal"))
            .collect::<Result<Vec<_>>>()?;
        self.nonce += 1;
        let salt = sha256(format!("soroscope-dev salt {}", self.nonce).as_bytes());
        let hf = HostFunction::CreateContractV2(CreateContractArgsV2 {
            contract_id_preimage: ContractIdPreimage::Address(ContractIdPreimageFromAddress {
                address: ScAddress::Account(self.source.clone()),
                salt: Uint256(salt),
            }),
            executable: ContractExecutable::Wasm(Hash(unhex(&wasm_hash)?)),
            constructor_args: args.try_into().map_err(err)?,
        });
        let sim = self.run(hf)?;
        self.require_ok(&sim, "deploy")?;
        self.commit(&sim)?;
        let id = match sim.invoke_result {
            Ok(ScVal::Address(ScAddress::Contract(ContractId(Hash(id))))) => id,
            other => return Err(err(format!("deploy returned an unexpected value: {other:?}"))),
        };
        Ok(DeployResult { contract_id: stellar_strkey::Contract(id).to_string(), wasm_hash })
    }

    /// Call `function` on `contract_id` with `args` (base64 `ScVal` each).
    /// Returns a JSON `simulateTransaction`-shaped response. When `commit` is
    /// true (the default) and the call succeeds, its writes are applied to the
    /// local ledger; when false, the call is a pure simulation.
    #[napi]
    pub fn invoke(
        &mut self,
        contract_id: String,
        function: String,
        args: Vec<String>,
        commit: Option<bool>,
    ) -> Result<String> {
        let args = args
            .iter()
            .map(|a| from_b64::<ScVal>(a, "argument ScVal"))
            .collect::<Result<Vec<_>>>()?;
        let hf = HostFunction::InvokeContract(InvokeContractArgs {
            contract_address: ScAddress::Contract(ContractId(Hash(parse_contract(&contract_id)?))),
            function_name: ScSymbol(function.try_into().map_err(err)?),
            args: args.try_into().map_err(err)?,
        });
        let sim = self.run(hf)?;
        if commit.unwrap_or(true) && sim.invoke_result.is_ok() {
            self.commit(&sim)?;
        }
        self.to_rpc_json(&sim)
    }

    /// Hot swap: point an existing contract at new WASM, in place. The
    /// contract ID, its instance storage and every persistent and temporary
    /// entry it owns are kept, as a real `update_current_contract_wasm` would,
    /// but without the contract having to expose an upgrade function.
    #[napi]
    pub fn swap_wasm(&mut self, contract_id: String, wasm: Buffer) -> Result<SwapResult> {
        let id = parse_contract(&contract_id)?;
        let key = Rc::new(instance_key(id));
        let (entry, live_until) = self
            .ledger
            .0
            .get(&key)
            .cloned()
            .ok_or_else(|| err(format!("no contract {contract_id} in the local ledger")))?;
        let new_hash = self.upload_wasm(wasm)?;
        let mut entry = (*entry).clone();
        let LedgerEntryData::ContractData(data) = &mut entry.data else {
            return Err(err("contract instance entry is not ContractData"));
        };
        let ScVal::ContractInstance(instance) = &mut data.val else {
            return Err(err("contract instance entry does not hold an instance"));
        };
        let old_hash = match &instance.executable {
            ContractExecutable::Wasm(Hash(h)) => hex(h),
            other => return Err(err(format!("contract is not a WASM contract ({other:?})"))),
        };
        instance.executable = ContractExecutable::Wasm(Hash(unhex(&new_hash)?));
        entry.last_modified_ledger_seq = self.ledger_info.sequence_number;
        self.ledger.0.insert(key, (Rc::new(entry), live_until));
        Ok(SwapResult { contract_id, old_wasm_hash: old_hash, new_wasm_hash: new_hash })
    }

    /// Number of entries in the local ledger (config settings included).
    #[napi(getter)]
    pub fn entry_count(&self) -> u32 {
        self.ledger.0.len() as u32
    }
}

impl Engine {
    fn run(&mut self, hf: HostFunction) -> Result<InvokeHostFunctionSimulationResult> {
        self.nonce += 1;
        let seed = sha256(format!("soroscope-dev prng {}", self.nonce).as_bytes());
        simulate_invoke_host_function_op(
            Rc::new(self.ledger.clone()),
            &self.network_config,
            &SimulationAdjustmentConfig::default_adjustment(),
            &self.ledger_info,
            hf,
            RecordingInvocationAuthMode::recording(false, false),
            &self.source,
            seed,
            true,
        )
        .map_err(|e| err(format!("host setup failed: {e:#}")))
    }

    fn require_ok(&self, sim: &InvokeHostFunctionSimulationResult, what: &str) -> Result<()> {
        match &sim.invoke_result {
            Ok(_) => Ok(()),
            Err(e) => Err(err(format!("{what} failed: {e:?}"))),
        }
    }

    /// Apply a successful call's writes. New entries get the network's
    /// minimum TTL for their durability; existing entries keep theirs.
    fn commit(&mut self, sim: &InvokeHostFunctionSimulationResult) -> Result<()> {
        let seq = self.ledger_info.sequence_number;
        for diff in &sim.modified_entries {
            let any = diff.state_after.as_ref().or(diff.state_before.as_ref());
            let Some(any) = any else { continue };
            let key = Rc::new(key_of(any)?);
            match &diff.state_after {
                None => {
                    self.ledger.0.remove(&key);
                }
                Some(after) => {
                    let live_until = match self.ledger.0.get(&key) {
                        Some((_, existing)) => *existing,
                        None => match &after.data {
                            LedgerEntryData::ContractData(d) => Some(match d.durability {
                                ContractDataDurability::Temporary => seq + self.ledger_info.min_temp_entry_ttl - 1,
                                ContractDataDurability::Persistent => seq + self.ledger_info.min_persistent_entry_ttl - 1,
                            }),
                            LedgerEntryData::ContractCode(_) => Some(seq + self.ledger_info.min_persistent_entry_ttl - 1),
                            _ => None,
                        },
                    };
                    let mut after = after.clone();
                    after.last_modified_ledger_seq = seq;
                    self.ledger.0.insert(key, (Rc::new(after), live_until));
                }
            }
        }
        Ok(())
    }

    fn to_rpc_json(&self, sim: &InvokeHostFunctionSimulationResult) -> Result<String> {
        let events = sim.diagnostic_events.iter().map(b64).collect::<Result<Vec<_>>>()?;
        let mut out = serde_json::json!({
            "latestLedger": self.ledger_info.sequence_number,
            "events": events,
            // Not part of the RPC response: the raw metered figures. transactionData
            // carries them plus Stellar RPC's default safety margins, so its
            // resources and fee match what simulateTransaction would return.
            "cpuInstructions": sim.simulated_instructions,
            "memoryBytes": sim.simulated_memory,
        });
        match &sim.invoke_result {
            Err(e) => {
                out["error"] = serde_json::Value::String(format!("{e:?}"));
            }
            Ok(value) => {
                let auth = sim.auth.iter().map(b64).collect::<Result<Vec<_>>>()?;
                out["results"] = serde_json::json!([{ "xdr": b64(value)?, "auth": auth }]);
                if let Some(td) = &sim.transaction_data {
                    out["transactionData"] = serde_json::Value::String(b64(td)?);
                    out["minResourceFee"] = serde_json::Value::String(td.resource_fee.to_string());
                }
                let mut changes = vec![];
                for d in &sim.modified_entries {
                    let any = d.state_after.as_ref().or(d.state_before.as_ref());
                    let Some(any) = any else { continue };
                    let kind = match (&d.state_before, &d.state_after) {
                        (None, Some(_)) => "created",
                        (Some(_), None) => "deleted",
                        _ => "updated",
                    };
                    changes.push(serde_json::json!({
                        "type": kind,
                        "key": b64(&key_of(any)?)?,
                        "before": d.state_before.as_ref().map(b64).transpose()?,
                        "after": d.state_after.as_ref().map(b64).transpose()?,
                    }));
                }
                out["stateChanges"] = serde_json::Value::Array(changes);
            }
        }
        serde_json::to_string(&out).map_err(err)
    }
}

fn instance_key(id: [u8; 32]) -> LedgerKey {
    LedgerKey::ContractData(LedgerKeyContractData {
        contract: ScAddress::Contract(ContractId(Hash(id))),
        key: ScVal::LedgerKeyContractInstance,
        durability: ContractDataDurability::Persistent,
    })
}

fn parse_contract(s: &str) -> Result<[u8; 32]> {
    stellar_strkey::Contract::from_string(s)
        .map(|c| c.0)
        .map_err(|e| err(format!("invalid contract id {s:?}: {e}")))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(s: &str) -> Result<[u8; 32]> {
    if s.len() != 64 {
        return Err(err(format!("expected 64 hex characters, got {}", s.len())));
    }
    let mut out = [0u8; 32];
    for (i, chunk) in s.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).map_err(err)?;
        out[i] = u8::from_str_radix(pair, 16).map_err(err)?;
    }
    Ok(out)
}
