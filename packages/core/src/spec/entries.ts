import type { XdrReader } from '../xdr/reader';
import { XdrUnsupportedError, decodeWith, readArray } from '../decode/primitives';

/** `SCSpecTypeDef`: a type as the contract declares it. */
export type SpecType =
  | {
      kind:
        | 'val' | 'bool' | 'void' | 'error' | 'u32' | 'i32' | 'u64' | 'i64' | 'timepoint'
        | 'duration' | 'u128' | 'i128' | 'u256' | 'i256' | 'bytes' | 'string' | 'symbol'
        | 'address' | 'muxedAddress';
    }
  | { kind: 'option'; value: SpecType }
  | { kind: 'result'; ok: SpecType; error: SpecType }
  | { kind: 'vec'; element: SpecType }
  | { kind: 'map'; key: SpecType; value: SpecType }
  | { kind: 'tuple'; elements: SpecType[] }
  | { kind: 'bytesN'; n: number }
  | { kind: 'udt'; name: string };

export interface SpecField {
  doc: string;
  name: string;
  type: SpecType;
}

export interface SpecFunction {
  kind: 'function';
  doc: string;
  name: string;
  inputs: SpecField[];
  outputs: SpecType[];
}

export interface SpecStruct {
  kind: 'struct';
  doc: string;
  lib: string;
  name: string;
  fields: SpecField[];
}

export interface SpecUnionCase {
  doc: string;
  name: string;
  /** Types carried by the case; empty for a unit case. */
  types: SpecType[];
}

export interface SpecUnion {
  kind: 'union';
  doc: string;
  lib: string;
  name: string;
  cases: SpecUnionCase[];
}

export interface SpecEnumCase {
  doc: string;
  name: string;
  value: number;
}

export interface SpecEnum {
  kind: 'enum';
  doc: string;
  lib: string;
  name: string;
  cases: SpecEnumCase[];
}

/** An enum whose values are the contract's error codes. */
export interface SpecErrorEnum {
  kind: 'errorEnum';
  doc: string;
  lib: string;
  name: string;
  cases: SpecEnumCase[];
}

export interface SpecEventParam {
  doc: string;
  name: string;
  type: SpecType;
  location: 'data' | 'topicList';
}

export interface SpecEvent {
  kind: 'event';
  doc: string;
  lib: string;
  name: string;
  prefixTopics: string[];
  params: SpecEventParam[];
  dataFormat: 'singleValue' | 'vec' | 'map';
}

export type SpecEntry = SpecFunction | SpecStruct | SpecUnion | SpecEnum | SpecErrorEnum | SpecEvent;

const SIMPLE_TYPES: Record<number, SpecType> = {
  0: { kind: 'val' },
  1: { kind: 'bool' },
  2: { kind: 'void' },
  3: { kind: 'error' },
  4: { kind: 'u32' },
  5: { kind: 'i32' },
  6: { kind: 'u64' },
  7: { kind: 'i64' },
  8: { kind: 'timepoint' },
  9: { kind: 'duration' },
  10: { kind: 'u128' },
  11: { kind: 'i128' },
  12: { kind: 'u256' },
  13: { kind: 'i256' },
  14: { kind: 'bytes' },
  16: { kind: 'string' },
  17: { kind: 'symbol' },
  19: { kind: 'address' },
  20: { kind: 'muxedAddress' },
};

export function readSpecType(reader: XdrReader): SpecType {
  const t = reader.readEnum();
  const simple = SIMPLE_TYPES[t];
  if (simple !== undefined) return simple;
  switch (t) {
    case 1000:
      return { kind: 'option', value: readSpecType(reader) };
    case 1001:
      return { kind: 'result', ok: readSpecType(reader), error: readSpecType(reader) };
    case 1002:
      return { kind: 'vec', element: readSpecType(reader) };
    case 1004:
      return { kind: 'map', key: readSpecType(reader), value: readSpecType(reader) };
    case 1005:
      return { kind: 'tuple', elements: readArray(reader, () => readSpecType(reader)) };
    case 1006:
      return { kind: 'bytesN', n: reader.readUint32() };
    case 2000:
      return { kind: 'udt', name: reader.readString() };
    default:
      throw new XdrUnsupportedError(`SCSpecType(${t})`, reader.position);
  }
}

function readField(reader: XdrReader): SpecField {
  return { doc: reader.readString(), name: reader.readString(), type: readSpecType(reader) };
}

function readEnumCase(reader: XdrReader): SpecEnumCase {
  return { doc: reader.readString(), name: reader.readString(), value: reader.readUint32() };
}

export function readSpecEntry(reader: XdrReader): SpecEntry {
  const kind = reader.readEnum();
  switch (kind) {
    case 0:
      return {
        kind: 'function',
        doc: reader.readString(),
        name: reader.readString(),
        inputs: readArray(reader, () => readField(reader)),
        outputs: readArray(reader, () => readSpecType(reader)),
      };
    case 1:
      return {
        kind: 'struct',
        doc: reader.readString(),
        lib: reader.readString(),
        name: reader.readString(),
        fields: readArray(reader, () => readField(reader)),
      };
    case 2: {
      const doc = reader.readString();
      const lib = reader.readString();
      const name = reader.readString();
      const cases = readArray(reader, (): SpecUnionCase => {
        const caseKind = reader.readEnum();
        const cdoc = reader.readString();
        const cname = reader.readString();
        if (caseKind === 0) return { doc: cdoc, name: cname, types: [] };
        if (caseKind === 1) {
          return { doc: cdoc, name: cname, types: readArray(reader, () => readSpecType(reader)) };
        }
        throw new XdrUnsupportedError(`SCSpecUDTUnionCaseV0Kind(${caseKind})`, reader.position);
      });
      return { kind: 'union', doc, lib, name, cases };
    }
    case 3:
      return {
        kind: 'enum',
        doc: reader.readString(),
        lib: reader.readString(),
        name: reader.readString(),
        cases: readArray(reader, () => readEnumCase(reader)),
      };
    case 4:
      return {
        kind: 'errorEnum',
        doc: reader.readString(),
        lib: reader.readString(),
        name: reader.readString(),
        cases: readArray(reader, () => readEnumCase(reader)),
      };
    case 5: {
      const doc = reader.readString();
      const lib = reader.readString();
      const name = reader.readString();
      const prefixTopics = readArray(reader, () => reader.readString());
      const params = readArray(reader, (): SpecEventParam => {
        const pdoc = reader.readString();
        const pname = reader.readString();
        const type = readSpecType(reader);
        const loc = reader.readEnum();
        if (loc !== 0 && loc !== 1) throw new XdrUnsupportedError(`SCSpecEventParamLocationV0(${loc})`, reader.position);
        return { doc: pdoc, name: pname, type, location: loc === 0 ? 'data' : 'topicList' };
      });
      const fmt = reader.readEnum();
      const dataFormat = (['singleValue', 'vec', 'map'] as const)[fmt];
      if (dataFormat === undefined) throw new XdrUnsupportedError(`SCSpecEventDataFormat(${fmt})`, reader.position);
      return { kind: 'event', doc, lib, name, prefixTopics, params, dataFormat };
    }
    default:
      throw new XdrUnsupportedError(`SCSpecEntryKind(${kind})`, reader.position);
  }
}

/** Decode a concatenated stream of `ScSpecEntry` values (the `contractspecv0` section). */
export function decodeSpecEntries(input: string | Uint8Array): SpecEntry[] {
  return decodeWith('ScSpecEntry stream', input, (reader) => {
    const out: SpecEntry[] = [];
    while (reader.remaining > 0) out.push(readSpecEntry(reader));
    return out;
  });
}

/** Render a spec type the way Rust would write it, for display. */
export function formatSpecType(t: SpecType): string {
  switch (t.kind) {
    case 'option':
      return `Option<${formatSpecType(t.value)}>`;
    case 'result':
      return `Result<${formatSpecType(t.ok)}, ${formatSpecType(t.error)}>`;
    case 'vec':
      return `Vec<${formatSpecType(t.element)}>`;
    case 'map':
      return `Map<${formatSpecType(t.key)}, ${formatSpecType(t.value)}>`;
    case 'tuple':
      return `(${t.elements.map(formatSpecType).join(', ')})`;
    case 'bytesN':
      return `BytesN<${t.n}>`;
    case 'udt':
      return t.name;
    case 'val':
      return 'Val';
    case 'void':
      return '()';
    default:
      return t.kind.charAt(0).toUpperCase() + t.kind.slice(1);
  }
}
