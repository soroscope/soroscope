import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { decodeStrkey } from '@soroscope/core';

const SEED_PATTERN = /S[A-Z2-7]{55}/g;

/** Version byte of a Stellar secret seed (`S...`), already shifted as SEP-23 does. */
const SEED_VERSION = 18 << 3;

/** True if `text` contains something that decodes as a Stellar secret seed. */
export function containsSecretSeed(text: string): boolean {
  for (const match of text.matchAll(SEED_PATTERN)) {
    try {
      const { version, payload } = decodeStrkey(match[0]);
      if (version === SEED_VERSION && payload.length === 32) return true;
    } catch {
      // Not a valid strkey after all: a false alarm, not a seed.
    }
  }
  return false;
}

/** Thrown when a tool input carries a secret key. The message tells the model what to do instead. */
export class SecretInInputError extends Error {
  constructor() {
    super(
      'This input contains what looks like a Stellar secret key (S...). Soroscope tools never need one and will not accept one. Remove it, and treat that key as exposed.',
    );
    this.name = 'SecretInInputError';
  }
}

/** Reject any string anywhere inside `value` that holds a secret seed. */
export function rejectSecrets(value: unknown): void {
  if (typeof value === 'string') {
    if (containsSecretSeed(value)) throw new SecretInInputError();
  } else if (Array.isArray(value)) {
    for (const v of value) rejectSecrets(v);
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (containsSecretSeed(k)) throw new SecretInInputError();
      rejectSecrets(v);
    }
  }
}

function ipv4IsPrivate(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function ipIsPrivate(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4IsPrivate(ip);
  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1] !== undefined) return ipv4IsPrivate(mapped[1]);
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

/**
 * A caller-supplied RPC URL may only point at the public internet over https.
 * Otherwise a model could be steered into probing internal services (SSRF).
 * Hostnames are resolved, and every address they resolve to must be public.
 */
export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`"${raw}" is not a valid URL.`);
  }
  if (url.protocol !== 'https:') throw new Error('Custom RPC URLs must use https.');
  if (url.username !== '' || url.password !== '') throw new Error('Custom RPC URLs must not embed credentials.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Custom RPC URLs must not point at a local or internal host.');
  }
  const addresses = isIP(host) === 0 ? (await lookup(host, { all: true })).map((a) => a.address) : [host];
  if (addresses.length === 0 || addresses.some(ipIsPrivate)) {
    throw new Error('Custom RPC URLs must resolve only to public addresses.');
  }
}
