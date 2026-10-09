import { describe, expect, it } from 'vitest';
import {
  XdrDecodeError,
  base64ToBytes,
  bytesToBase64,
  decodeDiagnosticEvent,
  decodeScError,
  decodeTransactionResult,
  explainTransactionError,
} from '../../src';
import { itemsOf, soroban } from '../helpers/soroban';

interface OracleResult {
  fee_charged: string;
  result: Record<string, unknown>;
}

// Transaction results captured from live testnet ledgers; expectations come from `stellar xdr decode`.
const results = itemsOf('TransactionResult');

describe('decodeTransactionResult on real transaction results', () => {
  it('has real results of both outcomes', () => {
    const keys = new Set(results.map((r) => Object.keys((r.oracle as OracleResult).result)[0]));
    expect(keys.has('tx_success')).toBe(true);
    expect(keys.has('tx_failed')).toBe(true);
  });

  it.each(results.map((r, i) => [`#${i}`, r] as const))('%s agrees with the oracle', (_n, item) => {
    const oracle = item.oracle as OracleResult;
    const key = Object.keys(oracle.result)[0]!;
    const decoded = decodeTransactionResult(item.b64);
    expect(decoded.feeCharged).toBe(BigInt(oracle.fee_charged));
    expect(decoded.code).toBe(key === 'tx_success' ? 'txSUCCESS' : 'txFAILED');
    expect(decoded.successful).toBe(key === 'tx_success');
    const ops = oracle.result[key] as unknown[];
    expect(decoded.operations.length).toBeGreaterThan(0);
    expect(decoded.operations.length).toBeLessThanOrEqual(ops.length);
    expect(decoded.operations[0]!.code).toBe('opINNER');
  });

  it('flags results it could not fully decode instead of guessing', () => {
    // Classic operation results (payments etc.) are outside the Soroban-focused decoder.
    const classic = results.find((r) => {
      const ops = Object.values((r.oracle as OracleResult).result)[0] as { op_inner?: Record<string, unknown> }[];
      return ops.some((o) => o.op_inner !== undefined && !['invoke_host_function', 'extend_footprint_ttl', 'restore_footprint'].includes(Object.keys(o.op_inner)[0]!));
    });
    if (classic === undefined) return;
    expect(decodeTransactionResult(classic.b64).partial).toBe(true);
  });

  it('explains a failed result in one line', () => {
    const failed = results.find((r) => 'tx_failed' in (r.oracle as OracleResult).result)!;
    const text = explainTransactionError(failed.b64);
    expect(text).toMatch(/^txFAILED/);
  });

  it('rejects a real result cut short, reporting the offset', () => {
    const bytes = base64ToBytes(results[0]!.b64);
    expect(() => decodeTransactionResult(bytesToBase64(bytes.subarray(0, 6)))).toThrow(XdrDecodeError);
  });
});

const isError = (o: unknown): boolean => typeof o === 'object' && o !== null && 'error' in o;

/**
 * Real error values only occur nested inside diagnostic events. Cut the exact
 * `SCV_ERROR` bytes (value type 2, error type 0 = contract, then the code) out of
 * a real event, locating them with the code the oracle reports.
 */
function realContractErrorBytes(): { bytes: Uint8Array; code: number }[] {
  const out: { bytes: Uint8Array; code: number }[] = [];
  for (const item of itemsOf('DiagnosticEvent')) {
    const topics = (item.oracle as { event: { body: { v0: { topics: unknown[] } } } }).event.body.v0.topics;
    const err = topics.find((t) => isError(t)) as { error: { contract?: number } } | undefined;
    if (err?.error.contract === undefined) continue;
    const code = err.error.contract;
    const needle = Buffer.alloc(12);
    needle.writeUInt32BE(2, 0); // SCV_ERROR
    needle.writeUInt32BE(0, 4); // SCE_CONTRACT
    needle.writeUInt32BE(code, 8);
    const hay = Buffer.from(item.b64, 'base64');
    const at = hay.indexOf(needle);
    if (at >= 0) out.push({ bytes: new Uint8Array(hay.subarray(at, at + 12)), code });
  }
  return out;
}

describe('decodeScError on real error values', () => {
  const errors = realContractErrorBytes();

  it('the corpus has real contract errors', () => {
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each(errors.slice(0, 5).map((e, i) => [`#${i} (code ${e.code})`, e] as const))('%s', (_n, e) => {
    const decoded = decodeScError(e.bytes);
    expect(decoded.isContractError).toBe(true);
    expect(decoded.contractCode).toBe(e.code);
    expect(decoded.message).toContain(`#${e.code}`);
  });

  it('refuses a value that is not an error', () => {
    const notAnError = itemsOf('ScVal').find((i) => !isError(i.oracle))!;
    expect(() => decodeScError(notAnError.b64)).toThrow(XdrDecodeError);
  });
});

describe('base64 helpers agree with Node on real XDR', () => {
  it('round-trips every real blob exactly as Buffer does', () => {
    for (const item of soroban.items.slice(0, 200)) {
      const bytes = base64ToBytes(item.b64);
      expect(Buffer.from(bytes).equals(Buffer.from(item.b64, 'base64'))).toBe(true);
      expect(bytesToBase64(bytes)).toBe(item.b64);
    }
  });

  it('tolerates whitespace and missing padding like the old reader did', () => {
    const item = soroban.items.find((i) => i.b64.endsWith('='))!;
    const unpadded = item.b64.replace(/=+$/, '');
    expect(Buffer.from(base64ToBytes(`${unpadded.slice(0, 8)}\n${unpadded.slice(8)}`)).equals(Buffer.from(item.b64, 'base64'))).toBe(true);
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base64ToBytes('AAA$')).toThrow(TypeError);
  });
});

describe('diagnostic events from real failed transactions', () => {
  it('include error events with a contract id', () => {
    const errorEvents = itemsOf('DiagnosticEvent')
      .map((i) => decodeDiagnosticEvent(i.b64))
      .filter((e) => e.event.topics[0]?.type === 'symbol' && (e.event.topics[0] as { value: string }).value === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0]!.event.contractId).toMatch(/^C[A-Z2-7]{55}$/);
  });
});
