import { decodeLedgerEntryData } from '../decode/ledger';
import { bytesToBase64 } from '../xdr/base64';
import { decodeContractId, fromHex } from '../xdr/strkey';
import { XdrWriter } from '../xdr/writer';
import type { RpcCaller } from '../rpc/types';
import { ContractSpec } from './ContractSpec';
import type { ContractSource } from './ContractSpec';
import { parseWasm } from './wasm';

/** The contract (or its code) is not on the ledger: it never existed, or its entry has expired. */
export class ContractNotFoundError extends Error {
  readonly contractId: string;

  constructor(contractId: string, what: string) {
    super(
      `${what} for contract ${contractId} was not found on the ledger. The contract may not exist on this network, or its storage may have been archived and need restoring.`,
    );
    this.name = 'ContractNotFoundError';
    this.contractId = contractId;
  }
}

/**
 * The base64 `LedgerKey` for a contract's instance entry, the key
 * `getLedgerEntries` needs to look the contract up.
 * @throws {TypeError} If `contractId` is not a valid `C...` address.
 */
export function contractInstanceKey(contractId: string): string {
  const w = new XdrWriter();
  w.writeInt32(6); // LedgerEntryType: CONTRACT_DATA
  w.writeInt32(1); // SCAddressType: CONTRACT
  w.writeFixedOpaque(decodeContractId(contractId));
  w.writeInt32(20); // SCValType: LEDGER_KEY_CONTRACT_INSTANCE
  w.writeInt32(1); // ContractDataDurability: PERSISTENT
  return bytesToBase64(w.toBytes());
}

/** The base64 `LedgerKey` for a stored WASM module, identified by its hex hash. */
export function contractCodeKey(wasmHashHex: string): string {
  const w = new XdrWriter();
  w.writeInt32(7); // LedgerEntryType: CONTRACT_CODE
  w.writeFixedOpaque(fromHex(wasmHashHex));
  return bytesToBase64(w.toBytes());
}

interface GetLedgerEntriesResult {
  entries?: { key: string; xdr: string; liveUntilLedgerSeq?: number }[] | null;
  latestLedger: number;
}

async function readEntry(caller: RpcCaller, key: string): Promise<string | null> {
  const res = await caller.call<GetLedgerEntriesResult>('getLedgerEntries', { keys: [key] });
  return res.entries?.[0]?.xdr ?? null;
}

/** Download a stored contract's WASM bytes by hash. */
export async function fetchWasm(caller: RpcCaller, wasmHashHex: string): Promise<Uint8Array> {
  const xdr = await readEntry(caller, contractCodeKey(wasmHashHex));
  if (xdr === null) throw new ContractNotFoundError(wasmHashHex, 'The WASM code');
  const entry = decodeLedgerEntryData(xdr);
  if (entry.type !== 'contractCode') {
    throw new TypeError(`Expected a contract code entry for ${wasmHashHex}, got ${entry.type}`);
  }
  return entry.code;
}

/** A deployed contract's code: its source, plus the WASM bytes when it has any. */
export interface ContractCode {
  source: ContractSource;
  /** The compiled module; null for the built-in Stellar Asset Contract. */
  wasm: Uint8Array | null;
}

/**
 * Look up a deployed contract and download its code: the contract instance
 * gives the WASM hash, the hash gives the WASM.
 * @throws {ContractNotFoundError} If the instance or its code is not on the ledger.
 */
export async function fetchContractCode(caller: RpcCaller, contractId: string): Promise<ContractCode> {
  const instanceXdr = await readEntry(caller, contractInstanceKey(contractId));
  if (instanceXdr === null) throw new ContractNotFoundError(contractId, 'The contract instance');
  const instance = decodeLedgerEntryData(instanceXdr);
  if (instance.type !== 'contractData' || instance.val.type !== 'contractInstance') {
    throw new TypeError(`${contractId} is not a contract instance`);
  }
  const exe = instance.val.executable;
  if (exe.type === 'stellarAsset') return { source: { kind: 'stellarAsset' }, wasm: null };
  return { source: { kind: 'wasm', wasmHash: exe.wasmHash }, wasm: await fetchWasm(caller, exe.wasmHash) };
}

/**
 * Look up a deployed contract and read its spec. Stellar Asset Contracts have
 * no WASM and yield an empty spec.
 * @throws {ContractNotFoundError} If the instance or its code is not on the ledger.
 */
export async function fetchContractSpec(caller: RpcCaller, contractId: string): Promise<ContractSpec> {
  const { source, wasm } = await fetchContractCode(caller, contractId);
  if (wasm === null) return ContractSpec.empty(source);
  const parsed = parseWasm(wasm);
  return new ContractSpec(parsed.spec, source, parsed.meta);
}
