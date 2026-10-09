/**
 * Typed errors for the RPC layer. Every error that crosses the transport keeps
 * the facts the router needs to decide what to do next (HTTP status,
 * Retry-After, JSON-RPC code) instead of flattening them into a message.
 */

/** Base class so callers can `instanceof RpcError` for any transport failure. */
export class RpcError extends Error {
  /** URL of the endpoint that produced the error, when known. */
  readonly url: string | undefined;

  constructor(message: string, url?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.url = url;
  }
}

/** DNS failure, refused connection, TLS failure: the request never got a response. */
export class RpcNetworkError extends RpcError {}

/** The request was aborted because it exceeded its time budget. */
export class RpcTimeoutError extends RpcError {
  readonly timeoutMs: number;

  constructor(message: string, url: string, timeoutMs: number, options?: { cause?: unknown }) {
    super(message, url, options);
    this.timeoutMs = timeoutMs;
  }
}

/** The endpoint answered with a non-2xx HTTP status. */
export class RpcHttpError extends RpcError {
  readonly status: number;
  /** Parsed `Retry-After`, in milliseconds, when the endpoint sent one. */
  readonly retryAfterMs: number | undefined;
  /** First characters of the response body, for diagnostics. */
  readonly bodySnippet: string;

  constructor(
    message: string,
    url: string,
    status: number,
    bodySnippet: string,
    retryAfterMs?: number,
  ) {
    super(message, url);
    this.status = status;
    this.bodySnippet = bodySnippet;
    this.retryAfterMs = retryAfterMs;
  }
}

/** The endpoint answered 2xx but the body was not a valid JSON-RPC 2.0 envelope. */
export class RpcProtocolError extends RpcError {
  readonly bodySnippet: string;

  constructor(message: string, url: string, bodySnippet: string) {
    super(message, url);
    this.bodySnippet = bodySnippet;
  }
}

/** The endpoint answered with a JSON-RPC `error` object. */
export class RpcResponseError extends RpcError {
  readonly code: number;
  readonly data: unknown;

  constructor(message: string, code: number, data?: unknown, url?: string) {
    super(message, url);
    this.code = code;
    this.data = data;
  }
}

/** One try against one provider, as recorded by the router. */
export interface Attempt {
  provider: string;
  ok: boolean;
  latencyMs: number;
  /** Failure class, present when `ok` is false. */
  failure?: string;
  message?: string;
}

/**
 * No provider can serve the request. Carries the reason each provider was
 * excluded so the caller can see, for example, that every provider's retention
 * window starts after the requested ledger.
 */
export class NoEligibleProviderError extends Error {
  readonly method: string;
  readonly excluded: readonly { provider: string; reason: string }[];

  constructor(method: string, excluded: readonly { provider: string; reason: string }[]) {
    const detail = excluded.map((e) => `${e.provider}: ${e.reason}`).join('; ');
    super(`No provider can serve ${method}. ${detail || 'No providers configured.'}`);
    this.name = 'NoEligibleProviderError';
    this.method = method;
    this.excluded = excluded;
  }
}

/** Every eligible provider was tried and failed. */
export class AllProvidersFailedError extends Error {
  readonly method: string;
  readonly attempts: readonly Attempt[];

  constructor(method: string, attempts: readonly Attempt[]) {
    const detail = attempts.map((a) => `${a.provider} (${a.failure ?? 'ok'})`).join(', ');
    super(`All providers failed for ${method}: ${detail}`);
    this.name = 'AllProvidersFailedError';
    this.method = method;
    this.attempts = attempts;
  }
}

/**
 * Parse an HTTP `Retry-After` header (delta-seconds or HTTP-date) into
 * milliseconds. Returns undefined for absent or unparseable values and clamps
 * the result to one hour so a hostile or buggy header cannot park a provider
 * forever.
 */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  let ms: number;
  if (/^\d+$/.test(trimmed)) {
    ms = Number(trimmed) * 1000;
  } else {
    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return undefined;
    ms = at - now;
  }
  return Math.min(Math.max(ms, 0), 3_600_000);
}
