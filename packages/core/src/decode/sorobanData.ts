import type { XdrReader } from '../xdr/reader';
import { readLedgerKey } from './ledger';
import type { LedgerKey } from './ledger';
import { XdrUnsupportedError, decodeWith, readArray } from './primitives';

export interface LedgerFootprint {
  readOnly: LedgerKey[];
  readWrite: LedgerKey[];
}

export interface SorobanResources {
  footprint: LedgerFootprint;
  /** CPU instruction budget. */
  instructions: number;
  /** Bytes read from disk (ledger entries not in memory). */
  diskReadBytes: number;
  writeBytes: number;
}

/** A decoded `SorobanTransactionData`: what a transaction declares it will touch and spend. */
export interface SorobanTransactionData {
  resources: SorobanResources;
  /** Resource fee in stroops. */
  resourceFee: bigint;
  /** Indexes of footprint entries that are archived and must be restored first (ext v1). */
  archivedEntries: number[];
}

export function readSorobanTransactionData(reader: XdrReader): SorobanTransactionData {
  const extV = reader.readEnum();
  let archivedEntries: number[] = [];
  if (extV === 1) {
    archivedEntries = readArray(reader, () => reader.readUint32());
  } else if (extV !== 0) {
    throw new XdrUnsupportedError(`SorobanTransactionData.ext(${extV})`, reader.position);
  }
  const readOnly = readArray(reader, () => readLedgerKey(reader));
  const readWrite = readArray(reader, () => readLedgerKey(reader));
  const instructions = reader.readUint32();
  const diskReadBytes = reader.readUint32();
  const writeBytes = reader.readUint32();
  const resourceFee = reader.readInt64();
  return {
    resources: { footprint: { readOnly, readWrite }, instructions, diskReadBytes, writeBytes },
    resourceFee,
    archivedEntries,
  };
}

export function decodeSorobanTransactionData(input: string | Uint8Array): SorobanTransactionData {
  return decodeWith('SorobanTransactionData', input, readSorobanTransactionData);
}
