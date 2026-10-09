// Maps Soroscope's decoded trees onto the JSON that `stellar xdr decode --output json`
// prints, so a decoder can be checked against an independent implementation.
// This file is test-only: it is NOT part of the library.
import type {
  AuthEntry,
  AuthorizedFunction,
  AuthorizedInvocation,
  DiagnosticEvent,
  LedgerEntryData,
  LedgerKey,
  ScAddress,
  ScVal,
  SorobanTransactionData,
} from '../../src';
import { toHex } from '../../src';

type Json = unknown;

const snake = (s: string, prefix: RegExp): string => s.replace(prefix, '').toLowerCase();

export function scValOracle(v: ScVal): Json {
  switch (v.type) {
    case 'bool':
      return { bool: v.value };
    case 'void':
      return 'void';
    case 'error': {
      const e = v.error;
      return e.isContractError
        ? { error: { contract: e.contractCode } }
        : { error: { [snake(e.type, /^SCE_/)]: snake(String(e.code), /^SCEC_/) } };
    }
    case 'u32':
    case 'i32':
      return { [v.type]: v.value };
    case 'u64':
    case 'i64':
    case 'timepoint':
    case 'duration':
    case 'u128':
    case 'i128':
    case 'u256':
    case 'i256':
      return { [v.type]: v.value.toString(10) };
    case 'bytes':
      return { bytes: toHex(v.value) };
    case 'string':
      return { string: v.value };
    case 'symbol':
      return { symbol: v.value };
    case 'vec':
      return { vec: v.value === null ? null : v.value.map(scValOracle) };
    case 'map':
      return {
        map:
          v.value === null
            ? null
            : v.value.map((e) => ({ key: scValOracle(e.key), val: scValOracle(e.val) })),
      };
    case 'address':
      return { address: v.value.address };
    case 'contractInstance':
      return {
        contract_instance: {
          executable: v.executable.type === 'stellarAsset' ? 'stellar_asset' : { wasm: v.executable.wasmHash },
          storage:
            v.storage === null
              ? null
              : v.storage.map((e) => ({ key: scValOracle(e.key), val: scValOracle(e.val) })),
        },
      };
    case 'ledgerKeyContractInstance':
      return 'ledger_key_contract_instance';
    case 'ledgerKeyNonce':
      return { ledger_key_nonce: { nonce: v.nonce.toString(10) } };
  }
}

export function ledgerKeyOracle(k: LedgerKey): Json {
  if (k.type === 'contractData') {
    return {
      contract_data: {
        contract: k.contract.address,
        key: scValOracle(k.key),
        durability: k.durability,
      },
    };
  }
  if (k.type === 'account') return { account: { account_id: k.accountId } };
  if (k.type === 'contractCode') return { contract_code: { hash: k.hash } };
  if (k.type === 'ttl') return { ttl: { key_hash: k.keyHash } };
  throw new Error(`no oracle mapping for ledger key type ${k.type}`);
}

export function diagnosticEventOracle(e: DiagnosticEvent): Json {
  return {
    in_successful_contract_call: e.inSuccessfulContractCall,
    event: {
      ext: 'v0',
      contract_id: e.event.contractId,
      type_: e.event.type,
      body: { v0: { topics: e.event.topics.map(scValOracle), data: scValOracle(e.event.data) } },
    },
  };
}

export function sorobanDataOracle(d: SorobanTransactionData): Json {
  return {
    ext: 'v0',
    resources: {
      footprint: {
        read_only: d.resources.footprint.readOnly.map(ledgerKeyOracle),
        read_write: d.resources.footprint.readWrite.map(ledgerKeyOracle),
      },
      instructions: d.resources.instructions,
      disk_read_bytes: d.resources.diskReadBytes,
      write_bytes: d.resources.writeBytes,
    },
    resource_fee: d.resourceFee.toString(10),
  };
}

function fnOracle(f: AuthorizedFunction): Json {
  if (f.type === 'contractFn') {
    return {
      contract_fn: {
        contract_address: f.contract.address,
        function_name: f.functionName,
        args: f.args.map(scValOracle),
      },
    };
  }
  throw new Error('no oracle mapping for create-contract invocations');
}

function invocationOracle(i: AuthorizedInvocation): Json {
  return { function: fnOracle(i.function), sub_invocations: i.subInvocations.map(invocationOracle) };
}

export function authEntryOracle(a: AuthEntry): Json {
  const c = a.credentials;
  return {
    credentials:
      c.type === 'sourceAccount'
        ? 'source_account'
        : {
            address: {
              address: (c.address as ScAddress).address,
              nonce: c.nonce.toString(10),
              signature_expiration_ledger: c.signatureExpirationLedger,
              signature: scValOracle(c.signature),
            },
          },
    root_invocation: invocationOracle(a.rootInvocation),
  };
}

export function ledgerEntryDataOracle(d: LedgerEntryData): Json {
  if (d.type === 'contractData') {
    return {
      contract_data: {
        ext: 'v0',
        contract: d.contract.address,
        key: scValOracle(d.key),
        durability: d.durability,
        val: scValOracle(d.val),
      },
    };
  }
  if (d.type === 'ttl') {
    return { ttl: { key_hash: d.keyHash, live_until_ledger_seq: d.liveUntilLedgerSeq } };
  }
  throw new Error(`no oracle mapping for ledger entry type ${d.type}`);
}

// ---- contract spec ------------------------------------------------------------
import type { SpecEntry, SpecType } from '../../src';

/**
 * The stellar CLI prints spec strings the way Rust's `u8::escape_ascii` does
 * (non-ASCII bytes as \xNN, newlines as \n). Apply the same rendering to our
 * real strings so the two can be compared.
 */
function cliEscape(text: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(text)) {
    if (byte === 0x09) out += '\\t';
    else if (byte === 0x0a) out += '\\n';
    else if (byte === 0x0d) out += '\\r';
    else if (byte === 0x5c) out += '\\\\';
    else if (byte >= 0x20 && byte <= 0x7e) out += String.fromCharCode(byte);
    else out += `\\x${byte.toString(16).padStart(2, '0')}`;
  }
  return out;
}

const SPEC_SIMPLE: Record<string, string> = { muxedAddress: 'muxed_address' };

export function specTypeOracle(t: SpecType): Json {
  switch (t.kind) {
    case 'option':
      return { option: { value_type: specTypeOracle(t.value) } };
    case 'result':
      return { result: { ok_type: specTypeOracle(t.ok), error_type: specTypeOracle(t.error) } };
    case 'vec':
      return { vec: { element_type: specTypeOracle(t.element) } };
    case 'map':
      return { map: { key_type: specTypeOracle(t.key), value_type: specTypeOracle(t.value) } };
    case 'tuple':
      return { tuple: { value_types: t.elements.map(specTypeOracle) } };
    case 'bytesN':
      return { bytes_n: { n: t.n } };
    case 'udt':
      return { udt: { name: t.name } };
    default:
      return SPEC_SIMPLE[t.kind] ?? t.kind;
  }
}

export function specEntryOracle(e: SpecEntry): Json {
  switch (e.kind) {
    case 'function':
      return {
        function_v0: {
          doc: cliEscape(e.doc),
          name: e.name,
          inputs: e.inputs.map((i) => ({ doc: cliEscape(i.doc), name: i.name, type_: specTypeOracle(i.type) })),
          outputs: e.outputs.map(specTypeOracle),
        },
      };
    case 'struct':
      return {
        udt_struct_v0: {
          doc: cliEscape(e.doc),
          lib: e.lib,
          name: e.name,
          fields: e.fields.map((f) => ({ doc: cliEscape(f.doc), name: f.name, type_: specTypeOracle(f.type) })),
        },
      };
    case 'union':
      return {
        udt_union_v0: {
          doc: cliEscape(e.doc),
          lib: e.lib,
          name: e.name,
          cases: e.cases.map((c) =>
            c.types.length === 0
              ? { void_v0: { doc: cliEscape(c.doc), name: c.name } }
              : { tuple_v0: { doc: cliEscape(c.doc), name: c.name, type_: c.types.map(specTypeOracle) } },
          ),
        },
      };
    case 'enum':
    case 'errorEnum':
      return {
        [e.kind === 'enum' ? 'udt_enum_v0' : 'udt_error_enum_v0']: {
          doc: cliEscape(e.doc),
          lib: e.lib,
          name: e.name,
          cases: e.cases.map((c) => ({ doc: cliEscape(c.doc), name: c.name, value: c.value })),
        },
      };
    case 'event':
      return {
        event_v0: {
          doc: cliEscape(e.doc),
          lib: e.lib,
          name: e.name,
          prefix_topics: e.prefixTopics,
          params: e.params.map((p) => ({
            doc: cliEscape(p.doc),
            name: p.name,
            type_: specTypeOracle(p.type),
            location: p.location === 'topicList' ? 'topic_list' : 'data',
          })),
          data_format: e.dataFormat === 'singleValue' ? 'single_value' : e.dataFormat,
        },
      };
  }
}
