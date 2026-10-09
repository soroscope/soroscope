import {
  RpcHttpError,
  RpcNetworkError,
  RpcProtocolError,
  RpcResponseError,
  RpcTimeoutError,
} from './errors';

/**
 * What kind of failure a request hit. The router uses the class, not the raw
 * error, to decide whether to fail over, back off, or give up.
 */
export type FailureClass =
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'protocol'
  | 'auth'
  | 'misconfigured'
  | 'out_of_retention'
  | 'unsupported_method'
  | 'invalid_request';

/** Failure classes that say something about the provider's health. */
export const HARD_FAILURES: ReadonlySet<FailureClass> = new Set<FailureClass>([
  'server',
  'timeout',
  'network',
  'protocol',
]);

/** The ledger range a provider reports when it rejects an out-of-range request. */
export interface RetentionRange {
  oldest: number;
  latest: number;
}

// Both messages were captured from live Stellar RPC providers (see
// tests/fixtures/rpc-errors.json):
//   getLedgers / getTransactions: "start ledger (N) must be between the oldest ledger: X and the latest ledger: Y for this rpc instance"
//   getEvents:                    "startLedger must be within the ledger range: X - Y"
const RANGE_PATTERNS: readonly RegExp[] = [
  /oldest ledger:\s*(\d+)\s+and the latest ledger:\s*(\d+)/i,
  /ledger range:\s*(\d+)\s*-\s*(\d+)/i,
];

/**
 * Extract the valid ledger range from an out-of-range error message.
 * Returns null when the message is not an out-of-range rejection.
 */
export function parseRetentionRange(message: string): RetentionRange | null {
  for (const pattern of RANGE_PATTERNS) {
    const match = pattern.exec(message);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      return { oldest: Number(match[1]), latest: Number(match[2]) };
    }
  }
  return null;
}

/** Map any error thrown by `RpcClient` onto a {@link FailureClass}. */
export function classifyFailure(err: unknown): FailureClass {
  if (err instanceof RpcTimeoutError) return 'timeout';
  if (err instanceof RpcNetworkError) return 'network';
  if (err instanceof RpcProtocolError) return 'protocol';
  if (err instanceof RpcHttpError) {
    if (err.status === 429) return 'rate_limited';
    if (err.status === 503 && err.retryAfterMs !== undefined) return 'rate_limited';
    if (err.status === 401 || err.status === 403) return 'auth';
    if (err.status === 408) return 'timeout';
    if (err.status === 404 || err.status === 405) return 'misconfigured';
    if (err.status >= 500) return 'server';
    return 'invalid_request';
  }
  if (err instanceof RpcResponseError) {
    if (err.code === -32601) return 'unsupported_method';
    if (parseRetentionRange(err.message) !== null) return 'out_of_retention';
    if (err.code === -32603) return 'server';
    return 'invalid_request';
  }
  return 'protocol';
}
