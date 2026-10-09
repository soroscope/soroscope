import {
  RpcHttpError,
  RpcNetworkError,
  RpcProtocolError,
  RpcResponseError,
  RpcTimeoutError,
  parseRetryAfter,
} from './errors';
import type { RpcCaller, RpcClientConfig, RpcRawResult, RpcCallOptions } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;
const SNIPPET_CHARS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSON-RPC 2.0 client for a single Stellar RPC endpoint. It does no retrying
 * and no failover: it reports exactly what happened (HTTP status, Retry-After,
 * latency, JSON-RPC error) so a router above it can decide what to do.
 */
export class RpcClient implements RpcCaller {
  readonly url: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private nextId = 1;

  constructor(config: RpcClientConfig) {
    if (typeof config.url !== 'string' || config.url === '') {
      throw new TypeError('RpcClient: url must be a non-empty string');
    }
    this.url = config.url;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.headers = { 'content-type': 'application/json', ...config.headers };
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Call a method and return only its `result`. */
  async call<T>(method: string, params?: unknown, options?: RpcCallOptions): Promise<T> {
    return (await this.callRaw<T>(method, params, options)).result;
  }

  /** Call a method and return the result together with transport details. */
  async callRaw<T>(
    method: string,
    params?: unknown,
    options?: RpcCallOptions,
  ): Promise<RpcRawResult<T>> {
    const id = this.nextId++;
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      ...(params === undefined ? {} : { params }),
    });

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = (): void => controller.abort();
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    const started = performance.now();
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: this.headers,
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      if (timedOut) {
        throw new RpcTimeoutError(
          `Request to ${this.url} timed out after ${timeoutMs}ms`,
          this.url,
          timeoutMs,
          { cause },
        );
      }
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new RpcNetworkError(`Request to ${this.url} failed: ${reason}`, this.url, { cause });
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      clearTimeout(timer);
      if (timedOut) {
        throw new RpcTimeoutError(
          `Reading response from ${this.url} timed out after ${timeoutMs}ms`,
          this.url,
          timeoutMs,
          { cause },
        );
      }
      throw new RpcNetworkError(`Reading response from ${this.url} failed`, this.url, { cause });
    }
    clearTimeout(timer);
    const latencyMs = performance.now() - started;
    const snippet = text.slice(0, SNIPPET_CHARS);

    if (!response.ok) {
      throw new RpcHttpError(
        `HTTP ${response.status} from ${this.url}`,
        this.url,
        response.status,
        snippet,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new RpcProtocolError(`Response from ${this.url} is not JSON`, this.url, snippet);
    }
    if (!isRecord(parsed) || parsed['jsonrpc'] !== '2.0') {
      throw new RpcProtocolError(`Response from ${this.url} is not JSON-RPC 2.0`, this.url, snippet);
    }

    const error = parsed['error'];
    if (isRecord(error)) {
      const code = typeof error['code'] === 'number' ? error['code'] : -32000;
      const message = typeof error['message'] === 'string' ? error['message'] : 'Unknown RPC error';
      throw new RpcResponseError(message, code, error['data'], this.url);
    }
    if (!('result' in parsed)) {
      throw new RpcProtocolError(`Response from ${this.url} has no result`, this.url, snippet);
    }

    return {
      result: parsed['result'] as T,
      httpStatus: response.status,
      headers: response.headers,
      latencyMs,
    };
  }
}

export default RpcClient;
