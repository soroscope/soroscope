import { classifyFailure } from '../rpc/classify';
import type { FailureClass } from '../rpc/classify';
import {
  AllProvidersFailedError,
  NoEligibleProviderError,
  RpcHttpError,
} from '../rpc/errors';
import type { Attempt } from '../rpc/errors';
import { RpcClient } from '../rpc/RpcClient';
import { ledgerObservationOf, startLedgerOf } from '../rpc/methods';
import type { RpcCallOptions, RpcCaller } from '../rpc/types';
import { ProviderRegistry } from './ProviderRegistry';
import type { ProviderInput, RoutingRequirements } from './ProviderRegistry';

export interface RouterConfig {
  /** Endpoints to route across: plain URLs or full provider inputs. */
  providers: readonly (string | ProviderInput)[];
  /** Per-request time budget in milliseconds. Default 15000. */
  timeoutMs?: number;
  /** Background `getHealth` refresh interval when `start()` is used. Default 30000. */
  refreshIntervalMs?: number;
  /** Most providers tried for one call. Default 3. */
  maxAttempts?: number;
  /** Longest the router will sleep waiting for a rate-limited provider. Default 5000. */
  maxWaitMs?: number;
  /** Largest tolerated lag behind the best provider, in ledgers. Default 3. */
  maxLagLedgers?: number;
  /** Injectable clock (epoch ms). */
  now?: () => number;
}

export interface RouterCallOptions extends RpcCallOptions {
  /** Constrain routing beyond what the method's params imply. */
  requires?: { startLedger?: number; maxLagLedgers?: number };
  /** Pin the call to a single provider id. */
  pin?: string;
  maxAttempts?: number;
  maxWaitMs?: number;
}

export interface DetailedResult<T> {
  result: T;
  provider: string;
  attempts: Attempt[];
}

export interface PerProviderResult<T> {
  provider: string;
  ok: boolean;
  latencyMs: number;
  result?: T;
  failure?: FailureClass;
  message?: string;
}

export interface RouteExplanation {
  method: string;
  startLedger: number | undefined;
  chosen: string | undefined;
  ranking: { provider: string; position: number }[];
  excluded: { provider: string; reason: string }[];
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_REFRESH_MS = 30_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** Let the process exit even while the timer is pending (Node, Bun); a no-op in browsers. */
function unref(timer: unknown): void {
  (timer as { unref?: () => void }).unref?.();
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Routes Stellar RPC calls across several providers. Unlike a latency-only
 * round robin it knows each provider's ledger lag, advertised retention window,
 * per-method history reach and rate-limit state, and only sends a request to a
 * provider that can actually serve it.
 */
export class SoroscopeRouter implements RpcCaller {
  readonly registry: ProviderRegistry;
  private readonly clients = new Map<string, RpcClient>();
  private readonly timeoutMs: number;
  private readonly refreshMs: number;
  private readonly defaultAttempts: number;
  private readonly defaultWaitMs: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(config: RouterConfig) {
    if (config.providers.length === 0) {
      throw new TypeError('SoroscopeRouter: at least one provider is required');
    }
    this.registry = new ProviderRegistry({
      ...(config.maxLagLedgers === undefined ? {} : { maxLagLedgers: config.maxLagLedgers }),
      ...(config.now === undefined ? {} : { now: config.now }),
    });
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.refreshMs = config.refreshIntervalMs ?? DEFAULT_REFRESH_MS;
    this.defaultAttempts = config.maxAttempts ?? 3;
    this.defaultWaitMs = config.maxWaitMs ?? 5_000;
    for (const p of config.providers) {
      const input: ProviderInput = typeof p === 'string' ? { url: p } : p;
      if (typeof input.url !== 'string' || input.url === '') {
        throw new TypeError('SoroscopeRouter: every provider needs a non-empty url');
      }
      const rec = this.registry.upsert(input);
      this.clients.set(
        rec.id,
        new RpcClient({
          url: input.url,
          timeoutMs: this.timeoutMs,
          ...(input.headers === undefined ? {} : { headers: input.headers }),
        }),
      );
    }
  }

  /** Build a router and wait for the first health reading so routing is informed from call one. */
  static async create(config: RouterConfig): Promise<SoroscopeRouter> {
    const router = new SoroscopeRouter(config);
    await router.refresh();
    return router;
  }

  /** Begin background health refreshes. The timer never keeps the process alive. */
  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = (): void => {
      if (!this.running) return;
      void this.refresh().finally(() => {
        if (!this.running) return;
        // Jitter so many routers do not hit providers in lockstep.
        const delay = Math.round(this.refreshMs * (0.85 + Math.random() * 0.3));
        this.timer = setTimeout(tick, delay);
        unref(this.timer);
      });
    };
    this.timer = setTimeout(tick, this.refreshMs);
    unref(this.timer);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  [Symbol.dispose](): void {
    this.stop();
  }

  /**
   * Read `getHealth` from every provider (and the network passphrase and
   * version once), updating latency, ledger bounds and status. Never throws:
   * a failing provider is recorded as failing.
   */
  async refresh(): Promise<void> {
    await Promise.allSettled(
      this.registry.list().map(async (rec) => {
        const client = this.clientOf(rec.id);
        try {
          const raw = await client.callRaw<{
            latestLedger: number;
            oldestLedger: number;
            ledgerRetentionWindow?: number;
          }>('getHealth');
          this.registry.recordSuccess(rec.id, {
            method: 'getHealth',
            latencyMs: raw.latencyMs,
          });
          this.registry.recordHealth(rec.id, raw.result);
          if (rec.chain.passphrase === null) await this.readChain(rec.id, client);
        } catch (err) {
          this.recordFailure(rec.id, 'getHealth', err, undefined);
        }
      }),
    );
  }

  /** Send a call to the best provider that can serve it, failing over on error. */
  async call<T>(method: string, params?: unknown, options?: RouterCallOptions): Promise<T> {
    return (await this.callDetailed<T>(method, params, options)).result;
  }

  async callDetailed<T>(
    method: string,
    params?: unknown,
    options: RouterCallOptions = {},
  ): Promise<DetailedResult<T>> {
    const startLedger = options.requires?.startLedger ?? startLedgerOf(method, params);
    const req: RoutingRequirements = {
      method,
      startLedger,
      maxLagLedgers: options.requires?.maxLagLedgers,
      pin: options.pin,
    };
    const maxAttempts = options.maxAttempts ?? this.defaultAttempts;
    const maxWaitMs = options.maxWaitMs ?? this.defaultWaitMs;
    const attempts: Attempt[] = [];
    const tried = new Set<string>();
    let waited = false;

    // A provider we have never heard from has unknown bounds: ask it once before routing on them.
    if (startLedger !== undefined) await this.refreshUnknown();

    while (attempts.length < maxAttempts) {
      const { eligible, excluded } = this.registry.eligible(req, tried);
      const next = eligible[0];
      if (next === undefined) {
        const recovery = this.registry.soonestRecovery();
        const now = this.registry.now();
        if (!waited && recovery !== null && recovery - now <= maxWaitMs && attempts.length === 0) {
          // Every provider is cooling down but one recovers soon: wait once rather than fail.
          waited = true;
          await sleep(recovery - now + 5, options.signal);
          continue;
        }
        if (attempts.length > 0) throw new AllProvidersFailedError(method, attempts);
        throw new NoEligibleProviderError(method, excluded);
      }

      tried.add(next.id);
      const client = this.clientOf(next.id);
      const started = performance.now();
      try {
        const raw = await client.callRaw<T>(method, params, {
          ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        });
        const ledger = ledgerObservationOf(raw.result);
        this.registry.recordSuccess(next.id, {
          method,
          latencyMs: raw.latencyMs,
          ...(ledger === undefined ? {} : { ledger }),
          startLedger,
        });
        attempts.push({ provider: next.id, ok: true, latencyMs: raw.latencyMs });
        return { result: raw.result, provider: next.id, attempts };
      } catch (err) {
        const failure = this.recordFailure(next.id, method, err, startLedger);
        attempts.push({
          provider: next.id,
          ok: false,
          latencyMs: performance.now() - started,
          failure,
          message: messageOf(err),
        });
        // Bad input fails the same way everywhere; retrying elsewhere only burns quota.
        if (failure === 'invalid_request') throw err;
        // A signed transaction may already have reached the node: only retry when it provably did not.
        if (method === 'sendTransaction' && failure !== 'network' && failure !== 'timeout') throw err;
      }
    }
    throw new AllProvidersFailedError(method, attempts);
  }

  /** Issue the same call to every provider in parallel, reporting each outcome. */
  async fanOut<T>(
    method: string,
    params?: unknown,
    options?: RpcCallOptions,
  ): Promise<PerProviderResult<T>[]> {
    const startLedger = startLedgerOf(method, params);
    return Promise.all(
      this.registry.list().map(async (rec): Promise<PerProviderResult<T>> => {
        const started = performance.now();
        try {
          const raw = await this.clientOf(rec.id).callRaw<T>(method, params, options);
          const ledger = ledgerObservationOf(raw.result);
          this.registry.recordSuccess(rec.id, {
            method,
            latencyMs: raw.latencyMs,
            ...(ledger === undefined ? {} : { ledger }),
            startLedger,
          });
          return { provider: rec.id, ok: true, latencyMs: raw.latencyMs, result: raw.result };
        } catch (err) {
          const failure = this.recordFailure(rec.id, method, err, startLedger);
          return {
            provider: rec.id,
            ok: false,
            latencyMs: performance.now() - started,
            failure,
            message: messageOf(err),
          };
        }
      }),
    );
  }

  /** Say which provider would be chosen for a call, and why the others would not, without calling anything. */
  explain(method: string, params?: unknown, options: RouterCallOptions = {}): RouteExplanation {
    const startLedger = options.requires?.startLedger ?? startLedgerOf(method, params);
    const { eligible, excluded } = this.registry.eligible({
      method,
      startLedger,
      maxLagLedgers: options.requires?.maxLagLedgers,
      pin: options.pin,
    });
    return {
      method,
      startLedger,
      chosen: eligible[0]?.id,
      ranking: eligible.map((rec, i) => ({ provider: rec.id, position: i + 1 })),
      excluded,
    };
  }

  /** Direct access to one provider's client (probing, diagnostics). */
  clientOf(id: string): RpcClient {
    const client = this.clients.get(id);
    if (client === undefined) throw new Error(`Unknown provider: ${id}`);
    return client;
  }

  private async refreshUnknown(): Promise<void> {
    const unknown = this.registry.list().filter((r) => r.ledger.latest === null);
    if (unknown.length === 0) return;
    await Promise.allSettled(
      unknown.map(async (rec) => {
        try {
          const raw = await this.clientOf(rec.id).callRaw<{
            latestLedger: number;
            oldestLedger: number;
            ledgerRetentionWindow?: number;
          }>('getHealth');
          this.registry.recordSuccess(rec.id, { method: 'getHealth', latencyMs: raw.latencyMs });
          this.registry.recordHealth(rec.id, raw.result);
        } catch (err) {
          this.recordFailure(rec.id, 'getHealth', err, undefined);
        }
      }),
    );
  }

  private async readChain(id: string, client: RpcClient): Promise<void> {
    try {
      const net = await client.call<{ passphrase: string; protocolVersion: number }>('getNetwork');
      this.registry.recordChain(id, {
        passphrase: net.passphrase,
        protocolVersion: net.protocolVersion,
      });
    } catch {
      // Chain identity is advisory; a provider that cannot answer getNetwork is still routable.
    }
    try {
      const ver = await client.call<{ version: string }>('getVersionInfo');
      this.registry.recordChain(id, { version: ver.version });
    } catch {
      // Older RPC versions do not implement getVersionInfo.
    }
  }

  private recordFailure(
    id: string,
    method: string,
    err: unknown,
    startLedger: number | undefined,
  ): FailureClass {
    const failure = classifyFailure(err);
    this.registry.recordFailure(id, {
      method,
      class: failure,
      message: messageOf(err),
      retryAfterMs: err instanceof RpcHttpError ? err.retryAfterMs : undefined,
      startLedger,
    });
    return failure;
  }
}

