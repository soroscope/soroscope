export interface RpcClientConfig {
  url: string;
  /** Per-request time budget in milliseconds. Default 30000. */
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Override the fetch implementation (custom runtimes, proxies). Defaults to global fetch. */
  fetch?: typeof fetch;
}

export interface RpcCallOptions {
  /** Overrides the client's default time budget for this call. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** A successful call together with what the transport observed. */
export interface RpcRawResult<T> {
  result: T;
  httpStatus: number;
  headers: Headers;
  latencyMs: number;
}

/**
 * Anything that can issue a JSON-RPC call. Both `RpcClient` (one endpoint) and
 * the router (many endpoints) satisfy it, so simulation, decoding and spec
 * code works against either.
 */
export interface RpcCaller {
  call<T>(method: string, params?: unknown, options?: RpcCallOptions): Promise<T>;
}
