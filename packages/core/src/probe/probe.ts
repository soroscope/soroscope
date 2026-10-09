import { classifyFailure } from '../rpc/classify';
import type { FailureClass } from '../rpc/classify';
import { RpcClient } from '../rpc/RpcClient';
import { RpcHttpError } from '../rpc/errors';
import { LEDGER_CLOSE_MS, providerIdOf } from '../routing/ProviderRegistry';
import type { ProviderInput } from '../routing/ProviderRegistry';

/** Ledgers per day at the ~5s close time. */
const LEDGERS_PER_DAY = Math.round(86_400_000 / LEDGER_CLOSE_MS);

export interface ProbeOptions {
  /** Sequential `getHealth` samples per provider. Default 5. */
  samples?: number;
  /** Pause between samples, ms. Default 150. */
  intervalMs?: number;
  /** Per-request time budget, ms. Default 15000. */
  timeoutMs?: number;
  /** Measure how far back `getLedgers` really reaches. Default true. */
  reach?: boolean;
  /** Send this many parallel `getHealth` calls to find the rate limit. 0 disables. Default 0. */
  burst?: number;
}

export interface LatencySummary {
  samples: number;
  errors: number;
  minMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

export interface BurstResult {
  requests: number;
  ok: number;
  rateLimited: number;
  firstRateLimitAt: number | null;
  retryAfterMs: number | null;
  /** `x-ratelimit-*` / `ratelimit-*` response headers, when present. */
  headers: Record<string, string>;
}

export interface ProviderProbe {
  provider: string;
  url: string;
  reachable: boolean;
  status: 'healthy' | 'degraded' | 'unreachable' | 'misconfigured';
  failure: { class: FailureClass; message: string } | null;
  latency: LatencySummary;
  passphrase: string | null;
  protocolVersion: number | null;
  version: string | null;
  ledger: {
    latest: number | null;
    oldest: number | null;
    /** Ledgers behind the best provider in this probe run. */
    lag: number | null;
    retentionWindow: number | null;
    /** Days of history the advertised window covers. */
    advertisedDays: number | null;
  };
  reach: {
    /** Oldest ledger `getLedgers` was shown to serve, or null if it could not be measured. */
    getLedgersOldest: number | null;
    /** Days back from latest that `getLedgers` reaches. */
    getLedgersDays: number | null;
    /** True when `getLedgers` reaches meaningfully beyond the advertised window. */
    beyondWindow: boolean;
    /** Ledger lookups the probe spent measuring this. */
    lookups: number;
    /**
     * False when the provider answered the same lookup differently on retry:
     * its reach is unreliable (typically a load balancer over mixed backends).
     */
    consistent: boolean;
  };
  unsupported: string[];
  burst: BurstResult | null;
}

export interface ProbeReport {
  generatedAt: string;
  providers: ProviderProbe[];
  summary: {
    healthy: number;
    degraded: number;
    unreachable: number;
    misconfigured: number;
    maxLatestLedger: number | null;
  };
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1));
  return sorted[idx] ?? null;
}

function summarize(samples: number[], errors: number): LatencySummary {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples: samples.length,
    errors,
    minMs: sorted[0] ?? null,
    p50Ms: quantile(sorted, 0.5),
    p95Ms: quantile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? null,
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Health {
  latestLedger: number;
  oldestLedger: number;
  ledgerRetentionWindow?: number;
}

type Serves = 'yes' | 'no';

/** One `getLedgers` lookup. Transport trouble is retried once; it is not evidence either way. */
async function lookupOnce(client: RpcClient, ledger: number): Promise<Serves> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await client.call('getLedgers', { startLedger: ledger, pagination: { limit: 1 } });
      return 'yes';
    } catch (err) {
      const klass = classifyFailure(err);
      // Out-of-range and invalid-request answers mean "no".
      if (klass === 'out_of_retention' || klass === 'invalid_request') return 'no';
      if (attempt >= 1) throw err;
    }
  }
}

/**
 * Can this provider serve `getLedgers` from `ledger`? A refusal is asked a
 * second time: providers behind a load balancer can answer the same request
 * differently, and a single "no" would under-report their reach. `mixed` is
 * true when the two answers disagreed.
 */
async function servesLedger(
  client: RpcClient,
  ledger: number,
): Promise<{ ok: boolean; mixed: boolean }> {
  if ((await lookupOnce(client, ledger)) === 'yes') return { ok: true, mixed: false };
  if ((await lookupOnce(client, ledger)) === 'yes') return { ok: true, mixed: true };
  return { ok: false, mixed: false };
}

/**
 * Measure how far back `getLedgers` really reaches. `getHealth` only
 * advertises the recent window, but some providers serve `getLedgers` from a
 * data lake far beyond it. The search walks back in growing steps until the
 * provider refuses, then bisects between the last success and the first
 * refusal.
 */
async function measureGetLedgersReach(
  client: RpcClient,
  health: Health,
): Promise<{ oldest: number | null; lookups: number; consistent: boolean }> {
  let lookups = 0;
  let consistent = true;
  const probe = async (ledger: number): Promise<boolean> => {
    lookups += 1;
    const r = await servesLedger(client, ledger);
    if (r.mixed) consistent = false;
    return r.ok;
  };

  // The advertised oldest ledger should always be servable; if it is not, report nothing.
  let good = health.oldestLedger + 2;
  if (!(await probe(good))) return { oldest: null, lookups, consistent };

  const steps = [14, 30, 90, 180, 365, 730].map((days) => health.latestLedger - days * LEDGERS_PER_DAY);
  let bad: number | null = null;
  for (const candidate of steps) {
    if (candidate >= good) continue;
    if (candidate < 2) break;
    if (await probe(candidate)) good = candidate;
    else {
      bad = candidate;
      break;
    }
  }
  if (bad !== null) {
    // Bisect: ~6 lookups narrow the boundary to 1/64 of the gap.
    for (let i = 0; i < 6 && good - bad > 1000; i += 1) {
      const mid = Math.floor((good + bad) / 2);
      if (await probe(mid)) good = mid;
      else bad = mid;
    }
  }
  return { oldest: good, lookups, consistent };
}

async function runBurst(client: RpcClient, n: number, timeoutMs: number): Promise<BurstResult> {
  const result: BurstResult = {
    requests: n,
    ok: 0,
    rateLimited: 0,
    firstRateLimitAt: null,
    retryAfterMs: null,
    headers: {},
  };
  let completed = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      try {
        const raw = await client.callRaw('getHealth', undefined, { timeoutMs });
        result.ok += 1;
        for (const [k, v] of raw.headers.entries()) {
          if (/^(x-)?ratelimit/i.test(k)) result.headers[k] = v;
        }
      } catch (err) {
        if (classifyFailure(err) === 'rate_limited') {
          result.rateLimited += 1;
          result.firstRateLimitAt ??= completed;
          if (err instanceof RpcHttpError && err.retryAfterMs !== undefined) {
            result.retryAfterMs = err.retryAfterMs;
          }
        }
      } finally {
        completed += 1;
      }
    }),
  );
  return result;
}

async function probeOne(input: ProviderInput, opts: Required<ProbeOptions>): Promise<ProviderProbe> {
  const id = input.id ?? providerIdOf(input.url);
  const client = new RpcClient({
    url: input.url,
    timeoutMs: opts.timeoutMs,
    ...(input.headers === undefined ? {} : { headers: input.headers }),
  });
  const lat: number[] = [];
  let errors = 0;
  let health: Health | null = null;
  let failure: ProviderProbe['failure'] = null;

  for (let i = 0; i < opts.samples; i += 1) {
    try {
      const raw = await client.callRaw<Health>('getHealth');
      lat.push(raw.latencyMs);
      health = raw.result;
    } catch (err) {
      errors += 1;
      failure = {
        class: classifyFailure(err),
        message: err instanceof Error ? err.message : String(err),
      };
    }
    if (i < opts.samples - 1) await sleep(opts.intervalMs);
  }

  const probe: ProviderProbe = {
    provider: id,
    url: input.url,
    reachable: health !== null,
    status: 'unreachable',
    failure,
    latency: summarize(lat, errors),
    passphrase: null,
    protocolVersion: null,
    version: null,
    ledger: {
      latest: health?.latestLedger ?? null,
      oldest: health?.oldestLedger ?? null,
      lag: null,
      retentionWindow: health?.ledgerRetentionWindow ?? null,
      advertisedDays:
        health === null ? null : (health.latestLedger - health.oldestLedger) / LEDGERS_PER_DAY,
    },
    reach: {
      getLedgersOldest: null,
      getLedgersDays: null,
      beyondWindow: false,
      lookups: 0,
      consistent: true,
    },
    unsupported: [],
    burst: null,
  };

  if (health === null) {
    probe.status = failure?.class === 'auth' || failure?.class === 'misconfigured' ? 'misconfigured' : 'unreachable';
    return probe;
  }

  try {
    const net = await client.call<{ passphrase: string; protocolVersion: number }>('getNetwork');
    probe.passphrase = net.passphrase;
    probe.protocolVersion = net.protocolVersion;
  } catch (err) {
    if (classifyFailure(err) === 'unsupported_method') probe.unsupported.push('getNetwork');
  }
  try {
    const ver = await client.call<{ version: string }>('getVersionInfo');
    probe.version = ver.version;
  } catch (err) {
    if (classifyFailure(err) === 'unsupported_method') probe.unsupported.push('getVersionInfo');
  }
  try {
    await client.call('getFeeStats');
  } catch (err) {
    if (classifyFailure(err) === 'unsupported_method') probe.unsupported.push('getFeeStats');
  }

  if (opts.reach) {
    try {
      const { oldest, lookups, consistent } = await measureGetLedgersReach(client, health);
      probe.reach.lookups = lookups;
      probe.reach.consistent = consistent;
      if (oldest !== null) {
        probe.reach.getLedgersOldest = oldest;
        probe.reach.getLedgersDays = (health.latestLedger - oldest) / LEDGERS_PER_DAY;
        probe.reach.beyondWindow = oldest < health.oldestLedger - LEDGERS_PER_DAY;
      }
    } catch {
      // Transport trouble mid-measurement: leave reach unmeasured rather than guess.
    }
  }

  if (opts.burst > 0) probe.burst = await runBurst(client, opts.burst, opts.timeoutMs);

  probe.status = errors > 0 ? 'degraded' : 'healthy';
  return probe;
}

/**
 * Probe providers in parallel and report, per provider: latency distribution,
 * ledger lag against the best provider, advertised retention, how far back
 * `getLedgers` really reaches, and optionally its rate-limit behaviour.
 * Providers are probed concurrently with each other but each provider's
 * requests are sequential, so the probe is gentle on any one endpoint.
 */
export async function probeProviders(
  providers: readonly (string | ProviderInput)[],
  options: ProbeOptions = {},
): Promise<ProbeReport> {
  const opts: Required<ProbeOptions> = {
    samples: options.samples ?? 5,
    intervalMs: options.intervalMs ?? 150,
    timeoutMs: options.timeoutMs ?? 15_000,
    reach: options.reach ?? true,
    burst: options.burst ?? 0,
  };
  const inputs = providers.map((p): ProviderInput => (typeof p === 'string' ? { url: p } : p));
  const results = await Promise.all(inputs.map((p) => probeOne(p, opts)));

  const latests = results.map((r) => r.ledger.latest).filter((n): n is number => n !== null);
  const maxLatest = latests.length === 0 ? null : Math.max(...latests);
  for (const r of results) {
    if (maxLatest !== null && r.ledger.latest !== null) r.ledger.lag = maxLatest - r.ledger.latest;
    // A provider far behind the network is degraded even if every call succeeded.
    if (r.status === 'healthy' && (r.ledger.lag ?? 0) > 3) r.status = 'degraded';
  }

  const rank = (r: ProviderProbe): number =>
    r.status === 'healthy' ? 0 : r.status === 'degraded' ? 1 : 2;
  results.sort((a, b) => rank(a) - rank(b) || (a.latency.p50Ms ?? Infinity) - (b.latency.p50Ms ?? Infinity));

  return {
    generatedAt: new Date().toISOString(),
    providers: results,
    summary: {
      healthy: results.filter((r) => r.status === 'healthy').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      unreachable: results.filter((r) => r.status === 'unreachable').length,
      misconfigured: results.filter((r) => r.status === 'misconfigured').length,
      maxLatestLedger: maxLatest,
    },
  };
}
