/**
 * Stellar StrKey (SEP-23) encoding: the human-readable `G...`, `C...`, `M...`,
 * `B...` and `L...` identifiers. Encode-only: XDR holds raw bytes, and
 * decoders need to show them as strkeys.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Version bytes, already shifted left by three bits as SEP-23 specifies. */
export const STRKEY_VERSION = {
  ed25519PublicKey: 6 << 3, // 'G'
  contract: 2 << 3, // 'C'
  muxedAccount: 12 << 3, // 'M'
  claimableBalance: 1 << 3, // 'B'
  liquidityPool: 11 << 3, // 'L'
} as const;

/** CRC-16/XMODEM (polynomial 0x1021, initial value 0), as SEP-23 specifies. */
export function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/** Encode a payload as a strkey with the given version byte. */
export function encodeStrkey(version: number, payload: Uint8Array): string {
  const body = new Uint8Array(1 + payload.length);
  body[0] = version;
  body.set(payload, 1);
  const crc = crc16Xmodem(body);
  const full = new Uint8Array(body.length + 2);
  full.set(body);
  // The checksum is appended little-endian.
  full[body.length] = crc & 0xff;
  full[body.length + 1] = crc >>> 8;
  return base32(full);
}

/** `G...` account id from a 32-byte ed25519 public key. */
export const encodeAccountId = (key: Uint8Array): string =>
  encodeStrkey(STRKEY_VERSION.ed25519PublicKey, key);

/** `C...` contract id from a 32-byte contract hash. */
export const encodeContractId = (hash: Uint8Array): string =>
  encodeStrkey(STRKEY_VERSION.contract, hash);

/** `M...` muxed account from a 32-byte key and a 64-bit id. */
export function encodeMuxedAccount(key: Uint8Array, id: bigint): string {
  const payload = new Uint8Array(40);
  payload.set(key);
  new DataView(payload.buffer).setBigUint64(32, id, false);
  return encodeStrkey(STRKEY_VERSION.muxedAccount, payload);
}

/** `B...` claimable balance id (type byte 0 followed by the 32-byte hash). */
export function encodeClaimableBalanceId(hash: Uint8Array): string {
  const payload = new Uint8Array(33);
  payload.set(hash, 1);
  return encodeStrkey(STRKEY_VERSION.claimableBalance, payload);
}

/** `L...` liquidity pool id from a 32-byte pool hash. */
export const encodeLiquidityPoolId = (hash: Uint8Array): string =>
  encodeStrkey(STRKEY_VERSION.liquidityPool, hash);

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

const DECODE: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

function unbase32(text: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text) {
    const v = DECODE[ch];
    if (v === undefined) throw new TypeError(`Invalid strkey character "${ch}"`);
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  return Uint8Array.from(out);
}

/**
 * Decode and validate a strkey: checks the alphabet, the length and the
 * CRC-16 checksum. Returns the version byte and the payload.
 * @throws {TypeError} If the string is not a well-formed strkey.
 */
export function decodeStrkey(text: string): { version: number; payload: Uint8Array } {
  if (!/^[A-Z2-7]+$/.test(text)) throw new TypeError(`"${text}" is not a strkey`);
  const raw = unbase32(text);
  if (raw.length < 3) throw new TypeError(`"${text}" is too short to be a strkey`);
  const body = raw.subarray(0, raw.length - 2);
  const crc = crc16Xmodem(body);
  const expected = (raw[raw.length - 2] ?? 0) | ((raw[raw.length - 1] ?? 0) << 8);
  if (crc !== expected) throw new TypeError(`"${text}" has an invalid strkey checksum`);
  // Re-encoding must reproduce the input, which rejects non-canonical trailing bits.
  if (encodeStrkey(body[0] ?? 0, body.subarray(1)) !== text) {
    throw new TypeError(`"${text}" is not a canonical strkey`);
  }
  return { version: body[0] ?? 0, payload: body.subarray(1) };
}

/** Decode a `C...` contract id into its 32-byte hash. */
export function decodeContractId(text: string): Uint8Array {
  const { version, payload } = decodeStrkey(text);
  if (version !== STRKEY_VERSION.contract || payload.length !== 32) {
    throw new TypeError(`"${text}" is not a contract id (expected a C... address)`);
  }
  return payload;
}

/** Decode a `G...` account id into its 32-byte ed25519 key. */
export function decodeAccountId(text: string): Uint8Array {
  const { version, payload } = decodeStrkey(text);
  if (version !== STRKEY_VERSION.ed25519PublicKey || payload.length !== 32) {
    throw new TypeError(`"${text}" is not an account id (expected a G... address)`);
  }
  return payload;
}

export function fromHex(hex: string): Uint8Array {
  if (!/^([0-9a-fA-F]{2})*$/.test(hex)) throw new TypeError('Invalid hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
