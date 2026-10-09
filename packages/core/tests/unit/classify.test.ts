import { describe, expect, it } from 'vitest';
import {
  RpcHttpError,
  RpcResponseError,
  classifyFailure,
  parseRetentionRange,
  parseRetryAfter,
} from '../../src';
import type { RpcSample } from '../helpers/fixtures';
import { bodyOf, loadFixture } from '../helpers/fixtures';

const errors = loadFixture('rpc-errors.json').samples;
const sample = (label: string): RpcSample => {
  const s = errors.find((e) => e.label === label);
  if (s === undefined) throw new Error(`fixture "${label}" is missing; re-run record-rpc.mjs`);
  return s;
};

/** Rebuild the error the client throws for a captured exchange. */
function errorFor(s: RpcSample): Error {
  if (s.httpStatus !== undefined && s.httpStatus !== 200) {
    return new RpcHttpError(`HTTP ${s.httpStatus}`, s.url, s.httpStatus, s.bodyText ?? '');
  }
  const err = bodyOf(s)['error'] as { code: number; message: string };
  return new RpcResponseError(err.message, err.code, undefined, s.url);
}

describe('classification of real provider responses', () => {
  it.each([
    ['out-of-retention getLedgers', 'out_of_retention'],
    ['out-of-retention getTransactions', 'out_of_retention'],
    ['out-of-retention getEvents', 'out_of_retention'],
    ['unknown method', 'unsupported_method'],
    ['bad path (HTTP 404)', 'misconfigured'],
    ['provider requiring an API key (HTTP 403)', 'auth'],
  ])('%s -> %s', (label, expected) => {
    expect(classifyFailure(errorFor(sample(label)))).toBe(expected);
  });
});

describe('parseRetentionRange on real out-of-range messages', () => {
  it.each(['getLedgers', 'getTransactions', 'getEvents'])('%s', (method) => {
    const s = sample(`out-of-retention ${method}`);
    const message = (bodyOf(s)['error'] as { message: string }).message;
    const range = parseRetentionRange(message);
    expect(range).not.toBeNull();
    // The provider states the valid range; it must bracket the ledger we sent... we sent one below it.
    const sent = (s.request.params as { startLedger: number }).startLedger;
    expect(range!.oldest).toBeGreaterThan(sent);
    expect(range!.latest).toBeGreaterThan(range!.oldest);
  });

  it('returns null for unrelated messages', () => {
    expect(parseRetentionRange('method not found')).toBeNull();
  });
});

describe('parseRetryAfter (RFC 9110 section 10.2.3 grammar)', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
  });

  it('reads an HTTP-date relative to now', () => {
    const now = Date.parse('Fri, 31 Dec 1999 23:59:50 GMT');
    expect(parseRetryAfter('Fri, 31 Dec 1999 23:59:59 GMT', now)).toBe(9_000);
  });

  it('clamps past dates to zero and absurd values to one hour', () => {
    const now = Date.parse('Sat, 01 Jan 2000 00:00:00 GMT');
    expect(parseRetryAfter('Fri, 31 Dec 1999 23:59:59 GMT', now)).toBe(0);
    expect(parseRetryAfter('99999999')).toBe(3_600_000);
  });

  it('ignores absent or malformed values', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});
