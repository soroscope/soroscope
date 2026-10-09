import { toHex } from '../xdr/strkey';

/**
 * Convert a decoded value into something `JSON.stringify` can carry: bigints
 * become decimal strings and byte arrays become hex. Everything else is kept.
 */
export function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString(10);
  if (value instanceof Uint8Array) return toHex(value);
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]));
  }
  return value;
}
