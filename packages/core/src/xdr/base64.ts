/**
 * Portable, dependency-free base64 codec.
 *
 * Works in Node.js, browsers, and edge runtimes without relying on `Buffer`,
 * `atob`, or `btoa` — Soroban RPC returns transaction results as standard
 * (RFC 4648) base64 strings, and this module turns them into raw bytes for the
 * XDR reader (and back again for round-trip/debugging).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Reverse lookup table: byte value of an ASCII char code, or -1 if not a
// base64 digit. A typed array always returns a `number`, sidestepping
// `noUncheckedIndexedAccess`.
const LOOKUP = /* @__PURE__ */ ((): Int16Array => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/**
 * Decodes a standard base64 string into raw bytes.
 *
 * Surrounding ASCII whitespace is ignored. Padding (`=`) is optional but, when
 * present, must be well-formed.
 *
 * @throws {TypeError} If the input contains a non-base64 character or has an
 *   invalid length.
 */
export function base64ToBytes(input: string): Uint8Array {
  let clean = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    clean += ch;
  }

  // Strip trailing padding; track how many bytes the final group encodes.
  let padded = clean.length;
  while (padded > 0 && clean[padded - 1] === '=') padded--;
  const unpadded = clean.slice(0, padded);

  if (unpadded.length % 4 === 1) {
    throw new TypeError('base64ToBytes: invalid base64 length');
  }

  const byteLength = Math.floor((unpadded.length * 3) / 4);
  const out = new Uint8Array(byteLength);

  let bits = 0;
  let acc = 0;
  let o = 0;

  for (let i = 0; i < unpadded.length; i++) {
    const value = LOOKUP[unpadded.charCodeAt(i)] ?? -1;
    if (value === -1) {
      throw new TypeError(
        `base64ToBytes: invalid base64 character ${JSON.stringify(unpadded.charAt(i))} at index ${i}`,
      );
    }
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }

  return out;
}

/**
 * Encodes raw bytes into a standard, padded base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // `charAt` always returns a string (never undefined), keeping this clean
  // under `noUncheckedIndexedAccess`; indices are pre-masked to 0–63.
  const enc = (n: number): string => ALPHABET.charAt(n & 63);
  let out = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1] as number;
    const b2 = bytes[i + 2] as number;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += enc(n >> 18) + enc(n >> 12) + enc(n >> 6) + enc(n);
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = (bytes[i] as number) << 16;
    out += enc(n >> 18) + enc(n >> 12) + '==';
  } else if (remaining === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    out += enc(n >> 18) + enc(n >> 12) + enc(n >> 6) + '=';
  }

  return out;
}
