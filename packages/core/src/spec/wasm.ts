import { XdrReader } from '../xdr/reader';
import { XdrDecodeError } from '../decode/types';
import { XdrUnsupportedError, decodeWith } from '../decode/primitives';
import { decodeSpecEntries } from './entries';
import type { SpecEntry } from './entries';

/** Contract metadata (`contractmetav0`) as key/value pairs, e.g. `rsver`, `rssdkver`. */
export type ContractMeta = Record<string, string>;

export interface ParsedWasm {
  spec: SpecEntry[];
  meta: ContractMeta;
  /** Soroban interface version from `contractenvmetav0`, when present. */
  envInterfaceVersion: { protocol: number; preRelease: number } | null;
  /** Names of every custom section found. */
  customSections: string[];
}

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

/** Read an unsigned LEB128 integer (at most 32 bits, as WebAssembly section sizes are). */
function readLeb128(bytes: Uint8Array, pos: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let p = pos;
  for (;;) {
    const byte = bytes[p];
    if (byte === undefined) throw new XdrDecodeError('WASM ends inside a LEB128 integer', p);
    p += 1;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new XdrDecodeError('WASM LEB128 integer is too large', p);
  }
  return { value: result >>> 0, next: p };
}

/** Walk the WebAssembly section table and return each custom section's name and payload. */
function customSections(wasm: Uint8Array): { name: string; data: Uint8Array }[] {
  if (wasm.length < 8 || WASM_MAGIC.some((b, i) => wasm[i] !== b)) {
    throw new XdrDecodeError('Not a WebAssembly module (missing \\0asm header)', 0);
  }
  const out: { name: string; data: Uint8Array }[] = [];
  let pos = 8;
  while (pos < wasm.length) {
    const id = wasm[pos];
    const size = readLeb128(wasm, pos + 1);
    const start = size.next;
    const end = start + size.value;
    if (end > wasm.length) throw new XdrDecodeError('WASM section extends past the end of the file', pos);
    if (id === 0) {
      const nameLen = readLeb128(wasm, start);
      const nameEnd = nameLen.next + nameLen.value;
      if (nameEnd > end) throw new XdrDecodeError('WASM custom section name overruns its section', start);
      out.push({
        name: new TextDecoder().decode(wasm.subarray(nameLen.next, nameEnd)),
        data: wasm.subarray(nameEnd, end),
      });
    }
    pos = end;
  }
  return out;
}

function decodeMeta(data: Uint8Array): ContractMeta {
  return decodeWith('ScMetaEntry stream', data, (reader: XdrReader) => {
    const meta: ContractMeta = {};
    while (reader.remaining > 0) {
      const kind = reader.readEnum();
      if (kind !== 0) throw new XdrUnsupportedError(`SCMetaKind(${kind})`, reader.position);
      meta[reader.readString()] = reader.readString();
    }
    return meta;
  });
}

function decodeEnvMeta(data: Uint8Array): { protocol: number; preRelease: number } | null {
  return decodeWith('ScEnvMetaEntry stream', data, (reader: XdrReader) => {
    let found: { protocol: number; preRelease: number } | null = null;
    while (reader.remaining > 0) {
      const kind = reader.readEnum();
      if (kind !== 0) throw new XdrUnsupportedError(`SCEnvMetaKind(${kind})`, reader.position);
      found = { protocol: reader.readUint32(), preRelease: reader.readUint32() };
    }
    return found;
  });
}

/**
 * Extract the contract spec, metadata and environment version from a compiled
 * Soroban contract. A module without a spec section yields an empty spec.
 * @throws {XdrDecodeError} If the bytes are not a well-formed WebAssembly module.
 */
export function parseWasm(wasm: Uint8Array): ParsedWasm {
  const sections = customSections(wasm);
  // A module may carry several sections of the same name (the Rust SDK appends metadata in
  // pieces), and their payloads form one logical stream in file order.
  const find = (name: string): Uint8Array | undefined => {
    const parts = sections.filter((s) => s.name === name).map((s) => s.data);
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  };
  const spec = find('contractspecv0');
  const meta = find('contractmetav0');
  const env = find('contractenvmetav0');
  return {
    spec: spec === undefined ? [] : decodeSpecEntries(spec),
    meta: meta === undefined ? {} : decodeMeta(meta),
    envInterfaceVersion: env === undefined ? null : decodeEnvMeta(env),
    customSections: sections.map((s) => s.name),
  };
}
