import { toHex } from '../xdr/strkey';
import type { XdrReader } from '../xdr/reader';
import { readAsset } from './ledger';
import type { Asset } from './ledger';
import { MAX_DEPTH, XdrUnsupportedError, decodeWith, readArray } from './primitives';
import { formatScVal, readContractExecutable, readScAddress, readScVal } from './scval';
import type { ContractExecutable, ScAddress, ScVal } from './scval';
import { XdrDecodeError } from './types';

export type ContractIdPreimage =
  | { type: 'address'; address: ScAddress; salt: string }
  | { type: 'asset'; asset: Asset };

export type AuthorizedFunction =
  | { type: 'contractFn'; contract: ScAddress; functionName: string; args: ScVal[] }
  | {
      type: 'createContract';
      preimage: ContractIdPreimage;
      executable: ContractExecutable;
      /** Present for the v2 form only. */
      constructorArgs: ScVal[] | null;
    };

/** A node in the tree of calls an authorization entry covers. */
export interface AuthorizedInvocation {
  function: AuthorizedFunction;
  subInvocations: AuthorizedInvocation[];
}

export type AuthCredentials =
  | { type: 'sourceAccount' }
  | {
      type: 'address';
      address: ScAddress;
      nonce: bigint;
      signatureExpirationLedger: number;
      /** `void` until the entry has been signed. */
      signature: ScVal;
    };

/** A decoded `SorobanAuthorizationEntry`. */
export interface AuthEntry {
  credentials: AuthCredentials;
  rootInvocation: AuthorizedInvocation;
}

function readPreimage(reader: XdrReader): ContractIdPreimage {
  const type = reader.readEnum();
  if (type === 0) {
    const address = readScAddress(reader);
    return { type: 'address', address, salt: toHex(reader.readFixedOpaque(32)) };
  }
  if (type === 1) return { type: 'asset', asset: readAsset(reader) };
  throw new XdrUnsupportedError(`ContractIDPreimageType(${type})`, reader.position);
}

function readFunction(reader: XdrReader): AuthorizedFunction {
  const type = reader.readEnum();
  switch (type) {
    case 0: {
      const contract = readScAddress(reader);
      const functionName = reader.readString();
      const args = readArray(reader, () => readScVal(reader));
      return { type: 'contractFn', contract, functionName, args };
    }
    case 1: {
      const preimage = readPreimage(reader);
      const executable = readContractExecutable(reader);
      return { type: 'createContract', preimage, executable, constructorArgs: null };
    }
    case 2: {
      const preimage = readPreimage(reader);
      const executable = readContractExecutable(reader);
      const constructorArgs = readArray(reader, () => readScVal(reader));
      return { type: 'createContract', preimage, executable, constructorArgs };
    }
    default:
      throw new XdrUnsupportedError(`SorobanAuthorizedFunctionType(${type})`, reader.position);
  }
}

function readInvocation(reader: XdrReader, depth: number): AuthorizedInvocation {
  if (depth > MAX_DEPTH) {
    throw new XdrDecodeError(`Invocation tree nesting exceeds ${MAX_DEPTH} levels`, reader.position);
  }
  const fn = readFunction(reader);
  const subInvocations = readArray(reader, () => readInvocation(reader, depth + 1));
  return { function: fn, subInvocations };
}

function readCredentials(reader: XdrReader): AuthCredentials {
  const type = reader.readEnum();
  if (type === 0) return { type: 'sourceAccount' };
  if (type === 1) {
    return {
      type: 'address',
      address: readScAddress(reader),
      nonce: reader.readInt64(),
      signatureExpirationLedger: reader.readUint32(),
      signature: readScVal(reader),
    };
  }
  throw new XdrUnsupportedError(`SorobanCredentialsType(${type})`, reader.position);
}

export function readAuthEntry(reader: XdrReader): AuthEntry {
  const credentials = readCredentials(reader);
  return { credentials, rootInvocation: readInvocation(reader, 0) };
}

export function decodeAuthEntry(input: string | Uint8Array): AuthEntry {
  return decodeWith('SorobanAuthorizationEntry', input, readAuthEntry);
}

function describeFunction(fn: AuthorizedFunction): string {
  if (fn.type === 'contractFn') {
    return `${fn.contract.address}.${fn.functionName}(${fn.args.map(formatScVal).join(', ')})`;
  }
  const exe = fn.executable.type === 'wasm' ? `wasm ${fn.executable.wasmHash.slice(0, 8)}…` : 'stellarAsset';
  return `create contract (${exe})`;
}

/** Render an invocation tree as indented lines, one call per line. */
export function describeInvocationTree(root: AuthorizedInvocation, indent = 0): string[] {
  return [
    `${'  '.repeat(indent)}${describeFunction(root.function)}`,
    ...root.subInvocations.flatMap((s) => describeInvocationTree(s, indent + 1)),
  ];
}

/** Who must sign an authorization entry, or null when the transaction source account covers it. */
export function authorizer(entry: AuthEntry): string | null {
  return entry.credentials.type === 'address' ? entry.credentials.address.address : null;
}
