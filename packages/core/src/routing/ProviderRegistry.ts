import { HARD_FAILURES, parseRetentionRange } from '../rpc/classify';
import type { FailureClass } from '../rpc/classify';
import { profileOf } from '../rpc/methods';
import type { LedgerObservation } from '../rpc/methods';

/** Average Stellar ledger close time, used to extrapolate stale ledger readings. */
export const LEDGER_CLOSE_MS = 5_000;

const SAMPLE_RING = 64;
const MIN_SAMPLES_FOR_P95 = 8;
const EWMA_ALPHA = 0.3;
const DEFAULT_LATENCY_MS = 1_500;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_BASE_MS = 10_000;
const CIRCUIT_MAX_MS = 300_000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 60_000;
/** A ledger reading is considered fresh enough for retention decisions this long. */
const RETENTION_MARGIN_LEDGERS = 2;
/**
 * Evidence about deep `getLedgers` reach expires. Providers behind a load
 * balancer can answer the same request differently from one call to the next
 * (observed on mainnet), so a single success or refusal is only a hint.
 */
const REACH_TTL_MS = 10 * 60_000;

export type ProviderStatus =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'limited'
  | 'unreachable'
  | 'misconfigured';

export interface LatencyStat {
  ewmaMs: number | null;
  p95Ms: number | null;
  samples: number;
  /** Ring buffer of the most recent samples (milliseconds). */
  recent: number[];
}

export interface ProviderInput {
  /** Stable identifier; defaults to the URL's host + path. */
  id?: string;
  url: string;
  /** Higher weight attracts more traffic. Default 1. */
  weight?: number;
  headers?: Record<string, string>;
}

export interface ProviderRecord {
  id: string;
  url: string;
  weight: number;
  headers: Record<string, string> | undefined;
  status: ProviderStatus;
  latency: { light: LatencyStat; heavy: LatencyStat };
  ledger: {
    latest: number | null;
    oldest: number | null;
    retentionWindow: number | null;
    /** Epoch ms at which `latest`/`oldest` were observed. */
    observedAt: number;
  };
  /**
   * The oldest ledger known to be servable by `getLedgers`, learned from probes
   * and successful calls. `null` means "unknown: assume the advertised window".
   * Expires after the reach TTL (ten minutes), because the same endpoint can answer
   * differently over time.
   */
  reach: { getLedgers: number | null; observedAt: number };
  chain: {
    passphrase: string | null;
    protocolVersion: number | null;
    version: string | null;
  };
  rateLimit: { limitedUntil: number | null; consecutive: number };
  circuit: {
    state: 'closed' | 'open' | 'half-open';
    consecutiveFailures: number;
    opens: number;
    openUntil: number | null;
    lastError: { class: FailureClass; message: string; at: number } | null;
  };
  unsupportedMethods: string[];
  misconfigured: boolean;
  counters: { requests: number; ok: number; byClass: Partial<Record<FailureClass, number>> };
}

export interface RegistryConfig {
  /** Largest tolerated lag, in ledgers, behind the best provider. Default 3. */
  maxLagLedgers?: number;
  /** Injectable clock (epoch ms). */
  now?: () => number;
}

export interface RoutingRequirements {
  method: string;
  /** Oldest ledger the request needs. */
  startLedger?: number | undefined;
  maxLagLedgers?: number | undefined;
  /** Pin the request to one provider id. */
  pin?: string | undefined;
}

export interface Exclusion {
  provider: string;
  reason: string;
}

/** JSON-safe snapshot of the registry, restorable with {@link ProviderRegistry.restore}. */
export interface RegistrySnapshot {
  takenAt: number;
  providers: ProviderRecord[];
}

function emptyStat(): LatencyStat {
  return { ewmaMs: null, p95Ms: null, samples: 0, recent: [] };
}

function pushSample(stat: LatencyStat, ms: number): void {
  stat.ewmaMs = stat.ewmaMs === null ? ms : EWMA_ALPHA * ms + (1 - EWMA_ALPHA) * stat.ewmaMs;
  stat.recent.push(ms);
  if (stat.recent.length > SAMPLE_RING) stat.recent.shift();
  stat.samples += 1;
  if (stat.recent.length >= MIN_SAMPLES_FOR_P95) {
    const sorted = [...stat.recent].sort((a, b) => a - b);
    stat.p95Ms = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
  }
}

/** Derive a stable provider id from its URL. */
export function providerIdOf(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '');
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

/**
 * Tracks everything the router knows about each provider and answers two
 * questions: "which providers can serve this request?" and "in what order
 * should they be tried?". It is a plain state machine: it performs no I/O and
 * takes its clock as a parameter, so its behaviour is a function of the
 * observations fed into it.
 */
export class ProviderRegistry {
  private readonly records = new Map<string, ProviderRecord>();
  private readonly maxLag: number;
  private readonly clock: () => number;

  constructor(config: RegistryConfig = {}) {
    this.maxLag = config.maxLagLedgers ?? 3;
    this.clock = config.now ?? ((): number => Date.now());
  }

  now(): number {
    return this.clock();
  }

  upsert(input: ProviderInput): ProviderRecord {
    const id = input.id ?? providerIdOf(input.url);
    const existing = this.records.get(id);
    if (existing !== undefined) {
      existing.url = input.url;
      existing.weight = input.weight ?? existing.weight;
      existing.headers = input.headers ?? existing.headers;
      return existing;
    }
    const record: ProviderRecord = {
      id,
      url: input.url,
      weight: input.weight ?? 1,
      headers: input.headers,
      status: 'unknown',
      latency: { light: emptyStat(), heavy: emptyStat() },
      ledger: { latest: null, oldest: null, retentionWindow: null, observedAt: 0 },
      reach: { getLedgers: null, observedAt: 0 },
      chain: { passphrase: null, protocolVersion: null, version: null },
      rateLimit: { limitedUntil: null, consecutive: 0 },
      circuit: {
        state: 'closed',
        consecutiveFailures: 0,
        opens: 0,
        openUntil: null,
        lastError: null,
      },
      unsupportedMethods: [],
      misconfigured: false,
      counters: { requests: 0, ok: 0, byClass: {} },
    };
    this.records.set(id, record);
    return record;
  }

  get(id: string): ProviderRecord | undefined {
    return this.records.get(id);
  }

  list(): ProviderRecord[] {
    return [...this.records.values()];
  }

  /** Record a successful call: latency, ledger bounds, and `getLedgers` reach evidence. */
  recordSuccess(
    id: string,
    obs: { method: string; latencyMs: number; ledger?: LedgerObservation | undefined; startLedger?: number | undefined },
  ): void {
    const rec = this.require(id);
    const at = this.now();
    rec.counters.requests += 1;
    rec.counters.ok += 1;
    pushSample(rec.latency[profileOf(obs.method).weight], obs.latencyMs);
    rec.circuit.state = 'closed';
    rec.circuit.consecutiveFailures = 0;
    rec.circuit.opens = 0;
    rec.circuit.openUntil = null;
    rec.rateLimit.consecutive = 0;
    rec.rateLimit.limitedUntil = null;
    rec.misconfigured = false;
    if (obs.ledger !== undefined) this.applyLedger(rec, obs.ledger, at);
    if (obs.method === 'getLedgers' && obs.startLedger !== undefined) {
      const known = this.reachOf(rec, at);
      rec.reach.getLedgers = known === null ? obs.startLedger : Math.min(known, obs.startLedger);
      rec.reach.observedAt = at;
    }
    this.refreshStatus(rec, at);
  }

  /** Record a failed call and update rate-limit, circuit and capability state. */
  recordFailure(
    id: string,
    failure: {
      method: string;
      class: FailureClass;
      message: string;
      retryAfterMs?: number | undefined;
      startLedger?: number | undefined;
    },
  ): void {
    const rec = this.require(id);
    const at = this.now();
    rec.counters.requests += 1;
    rec.counters.byClass[failure.class] = (rec.counters.byClass[failure.class] ?? 0) + 1;
    rec.circuit.lastError = { class: failure.class, message: failure.message, at };

    switch (failure.class) {
      case 'rate_limited': {
        rec.rateLimit.consecutive += 1;
        const backoff = Math.min(
          BACKOFF_MAX_MS,
          BACKOFF_BASE_MS * 2 ** (rec.rateLimit.consecutive - 1),
        );
        // Honour Retry-After when the provider sent one; otherwise back off exponentially with jitter.
        const wait = failure.retryAfterMs ?? Math.round(backoff * (0.75 + Math.random() * 0.5));
        rec.rateLimit.limitedUntil = at + wait;
        break;
      }
      case 'unsupported_method':
        if (!rec.unsupportedMethods.includes(failure.method)) {
          rec.unsupportedMethods.push(failure.method);
        }
        break;
      case 'auth':
      case 'misconfigured':
        rec.misconfigured = true;
        break;
      case 'out_of_retention': {
        const range = parseRetentionRange(failure.message);
        if (range !== null) {
          if (failure.method === 'getLedgers') {
            // The provider told us exactly how far back it can serve getLedgers.
            rec.reach.getLedgers = range.oldest;
            rec.reach.observedAt = at;
          } else {
            this.applyLedger(rec, { oldest: range.oldest, latest: range.latest }, at);
          }
        }
        break;
      }
      default:
        break;
    }

    if (HARD_FAILURES.has(failure.class)) {
      rec.circuit.consecutiveFailures += 1;
      if (rec.circuit.state === 'half-open' || rec.circuit.consecutiveFailures >= CIRCUIT_THRESHOLD) {
        rec.circuit.opens += 1;
        const open = Math.min(CIRCUIT_MAX_MS, CIRCUIT_BASE_MS * 2 ** (rec.circuit.opens - 1));
        rec.circuit.state = 'open';
        rec.circuit.openUntil = at + open;
      }
    }
    this.refreshStatus(rec, at);
  }

  /** Record a `getHealth` reading. */
  recordHealth(
    id: string,
    health: { latestLedger: number; oldestLedger: number; ledgerRetentionWindow?: number },
  ): void {
    const rec = this.require(id);
    this.applyLedger(rec, { latest: health.latestLedger, oldest: health.oldestLedger }, this.now());
    if (health.ledgerRetentionWindow !== undefined) {
      rec.ledger.retentionWindow = health.ledgerRetentionWindow;
    }
    this.refreshStatus(rec, this.now());
  }

  recordChain(
    id: string,
    chain: { passphrase?: string; protocolVersion?: number; version?: string },
  ): void {
    const rec = this.require(id);
    if (chain.passphrase !== undefined) rec.chain.passphrase = chain.passphrase;
    if (chain.protocolVersion !== undefined) rec.chain.protocolVersion = chain.protocolVersion;
    if (chain.version !== undefined) rec.chain.version = chain.version;
  }

  /** Extrapolated ledger bounds for a provider, assuming ~5s ledger closes since it was observed. */
  estimatedLedgers(id: string, at: number = this.now()): { latest: number | null; oldest: number | null } {
    const rec = this.require(id);
    if (rec.ledger.observedAt === 0) return { latest: rec.ledger.latest, oldest: rec.ledger.oldest };
    const elapsed = Math.max(0, Math.floor((at - rec.ledger.observedAt) / LEDGER_CLOSE_MS));
    return {
      latest: rec.ledger.latest === null ? null : rec.ledger.latest + elapsed,
      // A sliding retention window moves forward as the chain does.
      oldest: rec.ledger.oldest === null ? null : rec.ledger.oldest + elapsed,
    };
  }

  /** How many ledgers a provider trails the best provider on its network. */
  lagOf(id: string, at: number = this.now()): number | null {
    const rec = this.require(id);
    const mine = this.estimatedLedgers(id, at).latest;
    if (mine === null) return null;
    let best = mine;
    for (const other of this.records.values()) {
      if (other.id === id) continue;
      if (rec.chain.passphrase !== null && other.chain.passphrase !== null && other.chain.passphrase !== rec.chain.passphrase) continue;
      const theirs = this.estimatedLedgers(other.id, at).latest;
      if (theirs !== null && theirs > best) best = theirs;
    }
    return best - mine;
  }

  /**
   * The oldest ledger a provider can serve for a method, or null if unknown.
   * `getLedgers` can reach beyond the advertised window; everything else cannot.
   */
  oldestServable(id: string, method: string, at: number = this.now()): number | null {
    const rec = this.require(id);
    const advertised = this.estimatedLedgers(id, at).oldest;
    const reach = this.reachOf(rec, at);
    if (profileOf(method).history === 'deep' && reach !== null) {
      return advertised === null ? reach : Math.min(reach, advertised);
    }
    return advertised;
  }

  /** Split providers into those that can serve the request and those that cannot, with reasons. */
  eligible(
    req: RoutingRequirements,
    exclude: ReadonlySet<string> = new Set(),
    at: number = this.now(),
  ): { eligible: ProviderRecord[]; excluded: Exclusion[] } {
    const profile = profileOf(req.method);
    const maxLag = req.maxLagLedgers ?? this.maxLag;
    const eligible: ProviderRecord[] = [];
    // Providers whose reach for a deep-history method is unknown: worth trying last.
    const speculative: ProviderRecord[] = [];
    const excluded: Exclusion[] = [];

    for (const rec of this.records.values()) {
      const skip = (reason: string): void => {
        excluded.push({ provider: rec.id, reason });
      };
      if (req.pin !== undefined && rec.id !== req.pin) {
        skip('not the pinned provider');
        continue;
      }
      if (exclude.has(rec.id)) {
        skip('already tried');
        continue;
      }
      this.refreshStatus(rec, at);
      if (rec.misconfigured) {
        skip('misconfigured (auth or bad path)');
        continue;
      }
      if (rec.circuit.state === 'open') {
        skip(`circuit open for another ${Math.max(0, Math.ceil(((rec.circuit.openUntil ?? at) - at) / 1000))}s`);
        continue;
      }
      if (rec.rateLimit.limitedUntil !== null && rec.rateLimit.limitedUntil > at) {
        skip(`rate limited for another ${Math.ceil((rec.rateLimit.limitedUntil - at) / 1000)}s`);
        continue;
      }
      if (rec.unsupportedMethods.includes(req.method)) {
        skip(`does not support ${req.method}`);
        continue;
      }
      if (profile.needsFresh) {
        const lag = this.lagOf(rec.id, at);
        if (lag !== null && lag > maxLag) {
          skip(`lags the network by ${lag} ledgers (max ${maxLag})`);
          continue;
        }
      }
      if (req.startLedger !== undefined && profile.history !== 'none') {
        const oldest = this.oldestServable(rec.id, req.method, at);
        const latest = this.estimatedLedgers(rec.id, at).latest;
        if (oldest !== null && req.startLedger + RETENTION_MARGIN_LEDGERS < oldest) {
          if (profile.history === 'deep' && this.reachOf(rec, at) === null) {
            // Reach beyond the advertised window is unknown, not absent: try it last.
            speculative.push(rec);
            continue;
          }
          skip(`ledger ${req.startLedger} is older than its oldest servable ledger ${oldest}`);
          continue;
        }
        if (latest !== null && req.startLedger > latest + 1) {
          skip(`ledger ${req.startLedger} is newer than its latest ledger ${latest}`);
          continue;
        }
      }
      eligible.push(rec);
    }
    return {
      eligible: [...this.rank(eligible, req, at), ...this.rank(speculative, req, at)],
      excluded,
    };
  }

  /** Order providers best-first for a request. Deterministic: ties break on id. */
  rank(records: ProviderRecord[], req: RoutingRequirements, at: number = this.now()): ProviderRecord[] {
    const klass = profileOf(req.method).weight;
    const score = (rec: ProviderRecord): number => {
      const stat = rec.latency[klass];
      const base =
        stat.samples >= MIN_SAMPLES_FOR_P95 && stat.p95Ms !== null
          ? stat.p95Ms
          : (stat.ewmaMs ?? DEFAULT_LATENCY_MS);
      const lag = this.lagOf(rec.id, at) ?? 0;
      const degraded = rec.status === 'degraded' ? 2 : 1;
      return (base * (1 + 0.5 * lag) * degraded) / Math.max(rec.weight, 0.01);
    };
    return [...records].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
  }

  /** Earliest time any currently rate-limited or circuit-open provider becomes usable again. */
  soonestRecovery(at: number = this.now()): number | null {
    let soonest: number | null = null;
    for (const rec of this.records.values()) {
      for (const t of [rec.rateLimit.limitedUntil, rec.circuit.openUntil]) {
        if (t !== null && t > at && (soonest === null || t < soonest)) soonest = t;
      }
    }
    return soonest;
  }

  snapshot(): RegistrySnapshot {
    return { takenAt: this.now(), providers: structuredClone(this.list()) };
  }

  static restore(snapshot: RegistrySnapshot, config: RegistryConfig = {}): ProviderRegistry {
    const registry = new ProviderRegistry(config);
    for (const record of structuredClone(snapshot.providers)) registry.records.set(record.id, record);
    return registry;
  }

  /** Deep `getLedgers` reach, or null when unknown or older than the reach TTL (ten minutes). */
  private reachOf(rec: ProviderRecord, at: number): number | null {
    if (rec.reach.getLedgers === null || at - rec.reach.observedAt > REACH_TTL_MS) return null;
    return rec.reach.getLedgers;
  }

  private require(id: string): ProviderRecord {
    const rec = this.records.get(id);
    if (rec === undefined) throw new Error(`Unknown provider: ${id}`);
    return rec;
  }

  private applyLedger(rec: ProviderRecord, obs: LedgerObservation, at: number): void {
    // Compare against what the provider would be at *now* so an older reading never
    // moves the ledger backwards.
    if (obs.latest !== undefined) rec.ledger.latest = Math.max(obs.latest, rec.ledger.latest ?? 0);
    if (obs.oldest !== undefined) rec.ledger.oldest = obs.oldest;
    rec.ledger.observedAt = at;
  }

  private refreshStatus(rec: ProviderRecord, at: number): void {
    if (rec.circuit.state === 'open' && rec.circuit.openUntil !== null && at >= rec.circuit.openUntil) {
      rec.circuit.state = 'half-open';
    }
    if (rec.misconfigured) rec.status = 'misconfigured';
    else if (rec.circuit.state === 'open') rec.status = 'unreachable';
    else if (rec.rateLimit.limitedUntil !== null && rec.rateLimit.limitedUntil > at) rec.status = 'limited';
    else if (rec.counters.requests === 0) rec.status = 'unknown';
    else if (rec.circuit.consecutiveFailures > 0 || (this.lagOf(rec.id, at) ?? 0) > this.maxLag) rec.status = 'degraded';
    else rec.status = 'healthy';
  }
}
