import {
  encodeAccountId,
  encodeClaimableBalanceId,
  encodeContractId,
  encodeLiquidityPoolId,
  encodeMuxedAccount,
  toHex,
} from '../xdr/strkey';
import type { XdrReader } from '../xdr/reader';
import { readScError } from './scError';
import {
  MAX_DEPTH,
  XdrUnsupportedError,
  decodeWith,
  readArray,
  readOptional,
} from './primitives';
import type { DecodedScError } from './types';
import { XdrDecodeError } from './types';

/** `SCAddress`: an account, contract, muxed account, claimable balance or pool. */
export interface ScAddress {
  type: 'account' | 'contract' | 'muxedAccount' | 'claimableBalance' | 'liquidityPool';
  /** The strkey form: `G...`, `C...`, `M...`, `B...` or `L...`. */
  address: string;
}

/** `ContractExecutable`: either WASM identified by hash, or the built-in Stellar Asset Contract. */
export type ContractExecutable =
  | { type: 'wasm'; wasmHash: string }
  | { type: 'stellarAsset' };

export interface ScMapEntry {
  key: ScVal;
  val: ScVal;
}

/** A decoded Soroban `ScVal`, as a tagged union. 64-bit and larger integers are `bigint`. */
export type ScVal =
  | { type: 'bool'; value: boolean }
  | { type: 'void' }
  | { type: 'error'; error: DecodedScError }
  | { type: 'u32' | 'i32'; value: number }
  | {
      type: 'u64' | 'i64' | 'timepoint' | 'duration' | 'u128' | 'i128' | 'u256' | 'i256';
      value: bigint;
    }
  | { type: 'bytes'; value: Uint8Array }
  | { type: 'string'; value: string; bytes: Uint8Array }
  | { type: 'symbol'; value: string }
  | { type: 'vec'; value: ScVal[] | null }
  | { type: 'map'; value: ScMapEntry[] | null }
  | { type: 'address'; value: ScAddress }
  | { type: 'contractInstance'; executable: ContractExecutable; storage: ScMapEntry[] | null }
  | { type: 'ledgerKeyContractInstance' }
  | { type: 'ledgerKeyNonce'; nonce: bigint };

// SCValType discriminants (stellar-contract.x).
const SCV = {
  BOOL: 0,
  VOID: 1,
  ERROR: 2,
  U32: 3,
  I32: 4,
  U64: 5,
  I64: 6,
  TIMEPOINT: 7,
  DURATION: 8,
  U128: 9,
  I128: 10,
  U256: 11,
  I256: 12,
  BYTES: 13,
  STRING: 14,
  SYMBOL: 15,
  VEC: 16,
  MAP: 17,
  ADDRESS: 18,
  CONTRACT_INSTANCE: 19,
  LEDGER_KEY_CONTRACT_INSTANCE: 20,
  LEDGER_KEY_NONCE: 21,
} as const;

const utf8 = new TextDecoder();

/** Read a 32-byte ed25519 `PublicKey` (union with a single arm, type 0) as a `G...` id. */
export function readAccountId(reader: XdrReader): string {
  const type = reader.readEnum();
  if (type !== 0) throw new XdrUnsupportedError(`PublicKeyType(${type})`, reader.position);
  return encodeAccountId(reader.readFixedOpaque(32));
}

export function readScAddress(reader: XdrReader): ScAddress {
  const type = reader.readEnum();
  switch (type) {
    case 0:
      return { type: 'account', address: readAccountId(reader) };
    case 1:
      return { type: 'contract', address: encodeContractId(reader.readFixedOpaque(32)) };
    case 2: {
      const id = reader.readUint64();
      const key = reader.readFixedOpaque(32);
      return { type: 'muxedAccount', address: encodeMuxedAccount(key, id) };
    }
    case 3: {
      const idType = reader.readEnum();
      if (idType !== 0) throw new XdrUnsupportedError(`ClaimableBalanceIDType(${idType})`, reader.position);
      return { type: 'claimableBalance', address: encodeClaimableBalanceId(reader.readFixedOpaque(32)) };
    }
    case 4:
      return { type: 'liquidityPool', address: encodeLiquidityPoolId(reader.readFixedOpaque(32)) };
    default:
      throw new XdrUnsupportedError(`SCAddressType(${type})`, reader.position);
  }
}

export function readContractExecutable(reader: XdrReader): ContractExecutable {
  const type = reader.readEnum();
  if (type === 0) return { type: 'wasm', wasmHash: toHex(reader.readFixedOpaque(32)) };
  if (type === 1) return { type: 'stellarAsset' };
  throw new XdrUnsupportedError(`ContractExecutableType(${type})`, reader.position);
}

function readMapEntries(reader: XdrReader, depth: number): ScMapEntry[] {
  // key + val are each at least one 4-byte discriminant.
  return readArray(
    reader,
    () => {
      const key = readScValAt(reader, depth + 1);
      const val = readScValAt(reader, depth + 1);
      return { key, val };
    },
    8,
  );
}

function readScValAt(reader: XdrReader, depth: number): ScVal {
  if (depth > MAX_DEPTH) {
    throw new XdrDecodeError(`ScVal nesting exceeds ${MAX_DEPTH} levels`, reader.position);
  }
  const type = reader.readEnum();
  switch (type) {
    case SCV.BOOL:
      return { type: 'bool', value: reader.readBool() };
    case SCV.VOID:
      return { type: 'void' };
    case SCV.ERROR:
      return { type: 'error', error: readScError(reader) };
    case SCV.U32:
      return { type: 'u32', value: reader.readUint32() };
    case SCV.I32:
      return { type: 'i32', value: reader.readInt32() };
    case SCV.U64:
      return { type: 'u64', value: reader.readUint64() };
    case SCV.I64:
      return { type: 'i64', value: reader.readInt64() };
    case SCV.TIMEPOINT:
      return { type: 'timepoint', value: reader.readUint64() };
    case SCV.DURATION:
      return { type: 'duration', value: reader.readUint64() };
    case SCV.U128: {
      const hi = reader.readUint64();
      const lo = reader.readUint64();
      return { type: 'u128', value: (hi << 64n) | lo };
    }
    case SCV.I128: {
      const hi = reader.readInt64();
      const lo = reader.readUint64();
      // hi is signed, so adding (not OR-ing) keeps the sign.
      return { type: 'i128', value: (hi << 64n) + lo };
    }
    case SCV.U256: {
      const hh = reader.readUint64();
      const hl = reader.readUint64();
      const lh = reader.readUint64();
      const ll = reader.readUint64();
      return { type: 'u256', value: (hh << 192n) | (hl << 128n) | (lh << 64n) | ll };
    }
    case SCV.I256: {
      const hh = reader.readInt64();
      const hl = reader.readUint64();
      const lh = reader.readUint64();
      const ll = reader.readUint64();
      return { type: 'i256', value: (hh << 192n) + (hl << 128n) + (lh << 64n) + ll };
    }
    case SCV.BYTES:
      return { type: 'bytes', value: reader.readVarOpaque() };
    case SCV.STRING: {
      const bytes = reader.readVarOpaque();
      return { type: 'string', value: utf8.decode(bytes), bytes };
    }
    case SCV.SYMBOL:
      return { type: 'symbol', value: reader.readString() };
    case SCV.VEC:
      return {
        type: 'vec',
        value: readOptional(reader, () => readArray(reader, () => readScValAt(reader, depth + 1))),
      };
    case SCV.MAP:
      return { type: 'map', value: readOptional(reader, () => readMapEntries(reader, depth)) };
    case SCV.ADDRESS:
      return { type: 'address', value: readScAddress(reader) };
    case SCV.CONTRACT_INSTANCE: {
      const executable = readContractExecutable(reader);
      const storage = readOptional(reader, () => readMapEntries(reader, depth));
      return { type: 'contractInstance', executable, storage };
    }
    case SCV.LEDGER_KEY_CONTRACT_INSTANCE:
      return { type: 'ledgerKeyContractInstance' };
    case SCV.LEDGER_KEY_NONCE:
      return { type: 'ledgerKeyNonce', nonce: reader.readInt64() };
    default:
      throw new XdrUnsupportedError(`SCValType(${type})`, reader.position);
  }
}

/** Read an `ScVal` at the reader's current position. */
export function readScVal(reader: XdrReader): ScVal {
  return readScValAt(reader, 0);
}

/** Decode a base64 (or raw byte) `ScVal`. */
export function decodeScVal(input: string | Uint8Array): ScVal {
  return decodeWith('ScVal', input, readScVal);
}

const jsonSafe = (v: bigint): string => v.toString(10);

/**
 * Convert an `ScVal` into plain, JSON-safe JavaScript. Integers wider than 32
 * bits become decimal strings (JSON cannot carry them losslessly), bytes become
 * hex, addresses become strkeys, maps become arrays of `[key, value]` pairs
 * unless every key is a string or symbol (then an object).
 */
export function scValToJs(v: ScVal): unknown {
  switch (v.type) {
    case 'bool':
    case 'u32':
    case 'i32':
    case 'symbol':
      return v.value;
    case 'string':
      return v.value;
    case 'void':
      return null;
    case 'error':
      return { error: v.error.isContractError ? `Contract(#${v.error.contractCode})` : `${v.error.type}:${String(v.error.code)}` };
    case 'u64':
    case 'i64':
    case 'timepoint':
    case 'duration':
    case 'u128':
    case 'i128':
    case 'u256':
    case 'i256':
      return jsonSafe(v.value);
    case 'bytes':
      return toHex(v.value);
    case 'address':
      return v.value.address;
    case 'vec':
      return v.value === null ? null : v.value.map(scValToJs);
    case 'map': {
      if (v.value === null) return null;
      const stringKeys = v.value.every((e) => e.key.type === 'string' || e.key.type === 'symbol');
      if (stringKeys) {
        return Object.fromEntries(
          v.value.map((e) => [(e.key as { value: string }).value, scValToJs(e.val)]),
        );
      }
      return v.value.map((e) => [scValToJs(e.key), scValToJs(e.val)]);
    }
    case 'contractInstance':
      return {
        executable: v.executable.type === 'wasm' ? { wasm: v.executable.wasmHash } : 'stellarAsset',
        storage:
          v.storage === null
            ? null
            : v.storage.map((e) => [scValToJs(e.key), scValToJs(e.val)]),
      };
    case 'ledgerKeyContractInstance':
      return 'ledgerKeyContractInstance';
    case 'ledgerKeyNonce':
      return { nonce: jsonSafe(v.nonce) };
  }
}

const SHORT_HEX = 8;

/**
 * A compact, single-line, human-readable rendering of an `ScVal`, for logs and
 * error messages. Strings and symbols are quoted and contract-controlled text
 * is escaped, so it is safe to show to people and to language models.
 */
export function formatScVal(v: ScVal): string {
  switch (v.type) {
    case 'bool':
      return String(v.value);
    case 'void':
      return 'void';
    case 'error':
      return v.error.isContractError
        ? `Error(Contract, #${v.error.contractCode})`
        : `Error(${v.error.type}, ${String(v.error.code)})`;
    case 'u32':
    case 'i32':
      return `${v.type}(${v.value})`;
    case 'u64':
    case 'i64':
    case 'timepoint':
    case 'duration':
    case 'u128':
    case 'i128':
    case 'u256':
    case 'i256':
      return `${v.type}(${v.value})`;
    case 'bytes': {
      const hex = toHex(v.value);
      return `bytes(${hex.length > SHORT_HEX * 2 ? `${hex.slice(0, SHORT_HEX * 2)}…` : hex})`;
    }
    case 'string':
      return JSON.stringify(v.value);
    case 'symbol':
      return `:${v.value}`;
    case 'address':
      return v.value.address;
    case 'vec':
      return v.value === null ? 'vec(none)' : `[${v.value.map(formatScVal).join(', ')}]`;
    case 'map':
      return v.value === null
        ? 'map(none)'
        : `{${v.value.map((e) => `${formatScVal(e.key)}: ${formatScVal(e.val)}`).join(', ')}}`;
    case 'contractInstance':
      return `contractInstance(${v.executable.type === 'wasm' ? `wasm ${v.executable.wasmHash.slice(0, 8)}…` : 'stellarAsset'})`;
    case 'ledgerKeyContractInstance':
      return 'ledgerKey(contractInstance)';
    case 'ledgerKeyNonce':
      return `nonce(${v.nonce})`;
  }
}
