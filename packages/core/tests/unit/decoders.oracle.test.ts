import { describe, expect, it } from 'vitest';
import {
  XdrDecodeError,
  decodeAuthEntry,
  decodeDiagnosticEvent,
  decodeLedgerEntryData,
  decodeLedgerKey,
  decodeScVal,
  decodeSorobanTransactionData,
} from '../../src';
import {
  authEntryOracle,
  diagnosticEventOracle,
  ledgerEntryDataOracle,
  ledgerKeyOracle,
  scValOracle,
  sorobanDataOracle,
} from '../helpers/oracle';
import { itemsOf, soroban } from '../helpers/soroban';

// Every blob below was captured from the live Stellar testnet, and its expected
// value is what the official `stellar xdr decode` printed for the same bytes.

const CASES = [
  ['ScVal', decodeScVal, scValOracle],
  ['DiagnosticEvent', decodeDiagnosticEvent, diagnosticEventOracle],
  ['SorobanTransactionData', decodeSorobanTransactionData, sorobanDataOracle],
  ['SorobanAuthorizationEntry', decodeAuthEntry, authEntryOracle],
  ['LedgerKey', decodeLedgerKey, ledgerKeyOracle],
  ['LedgerEntryData', decodeLedgerEntryData, ledgerEntryDataOracle],
] as const;

describe('fixture sanity', () => {
  it('was recorded from a real network with an oracle for every item', () => {
    expect(soroban.provenance.tool).toContain('record-soroban');
    expect(soroban.items.length).toBeGreaterThan(100);
    expect(soroban.items.every((i) => i.oracle !== null)).toBe(true);
  });
});

describe.each(CASES)('%s decodes identically to the stellar CLI', (type, decode, toOracle) => {
  const items = itemsOf(type);

  it('has real fixtures', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it.each(items.map((i, n) => [`${i.source} #${n}`, i] as const))('%s', (_label, item) => {
    expect(toOracle(decode(item.b64) as never)).toEqual(item.oracle);
  });

  it('rejects every real blob when truncated, reporting where it failed', () => {
    for (const item of items.slice(0, 25)) {
      const bytes = Buffer.from(item.b64, 'base64');
      const cut = bytes.subarray(0, Math.max(0, bytes.length - 8));
      const err = (() => {
        try {
          decode(cut);
          return null;
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(XdrDecodeError);
      expect(typeof (err as XdrDecodeError).offset).toBe('number');
    }
  });

  it('rejects trailing garbage', () => {
    const first = items[0];
    if (first === undefined) return;
    const bytes = Buffer.concat([Buffer.from(first.b64, 'base64'), Buffer.alloc(4)]);
    expect(() => decode(bytes)).toThrow(XdrDecodeError);
  });
});

describe('breadth of the real corpus', () => {
  it('exercises the ScVal variety the decoder claims to support', () => {
    const kinds = new Set(itemsOf('ScVal').map((i) => Object.keys(i.oracle as object)[0] ?? String(i.oracle)));
    const events = itemsOf('DiagnosticEvent');
    for (const e of events) {
      const body = (e.oracle as { event: { body: { v0: { data: unknown } } } }).event.body.v0.data;
      kinds.add(typeof body === 'string' ? body : Object.keys(body as object)[0]!);
    }
    // Not exhaustive by design: COVERAGE.md tracks what live testnet could not produce.
    for (const k of ['u32', 'i128', 'symbol', 'address', 'map', 'vec', 'bytes', 'string', 'bool']) {
      expect(kinds.has(k), `no real ${k} value in the corpus`).toBe(true);
    }
  });
});
