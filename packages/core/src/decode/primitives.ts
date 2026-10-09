import { base64ToBytes } from '../xdr/base64';
import { XdrReader } from '../xdr/reader';
import { XdrDecodeError } from './types';

/** Deepest ScVal/invocation nesting accepted; the Soroban host itself caps far below this. */
export const MAX_DEPTH = 64;

/**
 * Read an XDR variable-length array count and reject counts that cannot fit in
 * the remaining input, so a hostile length cannot trigger a huge allocation.
 * `minBytes` is the smallest possible encoded element.
 */
export function readCount(reader: XdrReader, minBytes = 4): number {
  const n = reader.readLength();
  if (n * minBytes > reader.remaining) {
    throw new RangeError(
      `XdrReader: array of ${n} element(s) cannot fit in ${reader.remaining} remaining byte(s)`,
    );
  }
  return n;
}

export function readArray<T>(reader: XdrReader, readItem: () => T, minBytes = 4): T[] {
  const n = readCount(reader, minBytes);
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) out.push(readItem());
  return out;
}

/** XDR optional (`T*`): a boolean presence flag, then the value if present. */
export function readOptional<T>(reader: XdrReader, readItem: () => T): T | null {
  return reader.readBool() ? readItem() : null;
}

/** Throw a decode error naming the unsupported union arm, with the byte offset. */
export class XdrUnsupportedError extends XdrDecodeError {
  readonly arm: string;

  constructor(arm: string, offset: number) {
    super(
      `Unsupported XDR union arm ${arm} at byte offset ${offset}. It may be newer than this version of Soroscope understands.`,
      offset,
    );
    this.name = 'XdrUnsupportedError';
    this.arm = arm;
  }
}

/**
 * Decode `input` (base64 string or bytes) with `read`, wrapping low-level
 * failures into {@link XdrDecodeError} and rejecting trailing bytes.
 */
export function decodeWith<T>(
  what: string,
  input: string | Uint8Array,
  read: (reader: XdrReader) => T,
): T {
  let bytes: Uint8Array;
  try {
    bytes = typeof input === 'string' ? base64ToBytes(input) : input;
  } catch (err) {
    throw new XdrDecodeError(
      `Invalid base64 for ${what}: ${err instanceof Error ? err.message : String(err)}`,
      0,
    );
  }
  const reader = new XdrReader(bytes);
  let value: T;
  try {
    value = read(reader);
  } catch (err) {
    if (err instanceof XdrDecodeError) throw err;
    throw new XdrDecodeError(
      `Failed to decode ${what}: ${err instanceof Error ? err.message : String(err)}`,
      reader.position,
    );
  }
  if (reader.remaining !== 0) {
    throw new XdrDecodeError(
      `Failed to decode ${what}: ${reader.remaining} unexpected trailing byte(s) at offset ${reader.position}`,
      reader.position,
    );
  }
  return value;
}
