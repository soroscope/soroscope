import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../../src';
import { bodyOf, loadFixture } from '../helpers/fixtures';

const LEDGERS_PER_DAY = 17_280;

interface Health {
  latestLedger: number;
  oldestLedger: number;
  ledgerRetentionWindow: number;
}

const samples = loadFixture('rpc-health.json').samples.filter(
  (s) => s.network === 'mainnet' && s.httpStatus === 200,
);
// All readings were taken within seconds of each other; use the latest capture as "now".
const CAPTURE_TIME = Math.max(...samples.map((s) => s.capturedAtMs));

let now = CAPTURE_TIME;
let registry: ProviderRegistry;

function health(url: string): Health {
  const s = samples.find((x) => x.url === url);
  if (s === undefined) throw new Error(`no captured health for ${url}`);
  return (bodyOf(s)['result'] as Health);
}

const SDF_STYLE = 'https://rpc.lightsail.network'; // ~7 day window
const SHORT = 'https://soroban-rpc.creit.tech'; // ~1 day window
const TINY = 'https://archive-rpc.lightsail.network'; // ~64 ledger window

beforeEach(() => {
  now = CAPTURE_TIME;
  registry = new ProviderRegistry({ now: () => now });
  for (const s of samples) {
    const rec = registry.upsert({ url: s.url });
    registry.recordSuccess(rec.id, { method: 'getHealth', latencyMs: 200 });
    const h = bodyOf(s)['result'] as Health;
    registry.recordHealth(rec.id, h);
  }
});

/** The refusal creit.tech really returned for a 30-day-old getLedgers (see record-rpc.mjs). */
function realCreitRefusal(): string {
  const s = loadFixture('rpc-errors.json').samples.find(
    (x) => x.label === 'mainnet out-of-retention getLedgers (creit.tech)',
  );
  if (s === undefined) throw new Error('re-run packages/test-utils/scripts/record-rpc.mjs');
  return (bodyOf(s)['error'] as { message: string }).message;
}

const idOf = (url: string): string => new URL(url).host;
const latest = (): number => health(SDF_STYLE).latestLedger;

describe('retention-aware eligibility (real health readings)', () => {
  it('every provider can serve a method with no history requirement', () => {
    const { eligible } = registry.eligible({ method: 'getLatestLedger' });
    expect(eligible).toHaveLength(samples.length);
  });

  it('a 3-day-old getEvents request excludes the 1-day and 64-ledger providers, with reasons', () => {
    const { eligible, excluded } = registry.eligible({
      method: 'getEvents',
      startLedger: latest() - 3 * LEDGERS_PER_DAY,
    });
    const ids = eligible.map((r) => r.id);
    expect(ids).not.toContain(idOf(SHORT));
    expect(ids).not.toContain(idOf(TINY));
    expect(ids).toContain(idOf(SDF_STYLE));
    const reason = excluded.find((e) => e.provider === idOf(SHORT))?.reason ?? '';
    expect(reason).toMatch(/older than its oldest servable ledger/);
  });

  it('a request older than every window has no eligible provider', () => {
    const { eligible } = registry.eligible({
      method: 'getEvents',
      startLedger: latest() - 30 * LEDGERS_PER_DAY,
    });
    expect(eligible).toHaveLength(0);
  });

  it('getLedgers past the advertised window is tried speculatively, after the sure providers', () => {
    const { eligible } = registry.eligible({
      method: 'getLedgers',
      startLedger: latest() - 30 * LEDGERS_PER_DAY,
    });
    // Nobody is *known* to reach that far, so everyone is a speculative candidate.
    expect(eligible.length).toBe(samples.length);
  });

  it('a real out-of-range refusal teaches the registry the provider reach, excluding it', () => {
    const message = realCreitRefusal();
    const target = idOf(SHORT);
    registry.recordFailure(target, {
      method: 'getLedgers',
      class: 'out_of_retention',
      message,
    });
    const { eligible, excluded } = registry.eligible({
      method: 'getLedgers',
      startLedger: latest() - 30 * LEDGERS_PER_DAY,
    });
    expect(eligible.map((r) => r.id)).not.toContain(target);
    expect(excluded.some((e) => e.provider === target)).toBe(true);
  });

  it('forgets learned reach after it expires, because providers answer inconsistently', () => {
    const target = idOf(SHORT);
    registry.recordFailure(target, {
      method: 'getLedgers',
      class: 'out_of_retention',
      message: realCreitRefusal(),
    });
    const req = { method: 'getLedgers', startLedger: 63_000_000 };
    expect(registry.eligible(req).eligible.map((r) => r.id)).not.toContain(target);
    now += 11 * 60_000;
    expect(registry.eligible(req).eligible.map((r) => r.id)).toContain(target);
  });
});

describe('ledger lag', () => {
  it('a provider that stopped advancing falls behind and is excluded from fresh-state methods', () => {
    const stale = idOf(SDF_STYLE);
    // Everyone else is re-read a minute later; the stale provider is not.
    now += 60_000;
    for (const s of samples) {
      const id = idOf(s.url);
      if (id === stale) continue;
      const h = bodyOf(s)['result'] as Health;
      const elapsed = Math.floor(60_000 / 5_000);
      registry.recordHealth(id, {
        latestLedger: h.latestLedger + elapsed,
        oldestLedger: h.oldestLedger + elapsed,
      });
    }
    // The stale provider's *own* reading extrapolates forward, so lag only appears once it is
    // actually re-read and found behind.
    registry.recordHealth(stale, {
      latestLedger: health(SDF_STYLE).latestLedger,
      oldestLedger: health(SDF_STYLE).oldestLedger,
    });
    expect(registry.lagOf(stale)).toBeGreaterThan(3);
    const { eligible, excluded } = registry.eligible({ method: 'simulateTransaction' });
    expect(eligible.map((r) => r.id)).not.toContain(stale);
    expect(excluded.find((e) => e.provider === stale)?.reason).toMatch(/lags the network/);
  });
});

describe('circuit breaker and rate limiting', () => {
  it('opens after repeated hard failures and half-opens after the cool-down', () => {
    const id = idOf(SDF_STYLE);
    for (let i = 0; i < 3; i += 1) {
      registry.recordFailure(id, { method: 'getHealth', class: 'timeout', message: 'timed out' });
    }
    expect(registry.get(id)?.status).toBe('unreachable');
    expect(registry.eligible({ method: 'getHealth' }).eligible.map((r) => r.id)).not.toContain(id);
    now += 11_000;
    expect(registry.eligible({ method: 'getHealth' }).eligible.map((r) => r.id)).toContain(id);
    expect(registry.get(id)?.circuit.state).toBe('half-open');
  });

  it('closes again on success', () => {
    const id = idOf(SDF_STYLE);
    for (let i = 0; i < 3; i += 1) {
      registry.recordFailure(id, { method: 'getHealth', class: 'network', message: 'down' });
    }
    now += 11_000;
    registry.eligible({ method: 'getHealth' });
    registry.recordSuccess(id, { method: 'getHealth', latencyMs: 100 });
    expect(registry.get(id)?.circuit.state).toBe('closed');
    expect(registry.get(id)?.status).toBe('healthy');
  });

  it('honours Retry-After and does not count rate limiting toward the circuit', () => {
    const id = idOf(SDF_STYLE);
    registry.recordFailure(id, {
      method: 'getHealth',
      class: 'rate_limited',
      message: 'HTTP 429',
      retryAfterMs: 2_000,
    });
    expect(registry.get(id)?.circuit.consecutiveFailures).toBe(0);
    expect(registry.eligible({ method: 'getHealth' }).eligible.map((r) => r.id)).not.toContain(id);
    now += 2_100;
    expect(registry.eligible({ method: 'getHealth' }).eligible.map((r) => r.id)).toContain(id);
  });

  it('remembers unsupported methods and stops routing them there', () => {
    const id = idOf(SDF_STYLE);
    registry.recordFailure(id, { method: 'getFeeStats', class: 'unsupported_method', message: 'method not found' });
    expect(registry.eligible({ method: 'getFeeStats' }).eligible.map((r) => r.id)).not.toContain(id);
    expect(registry.eligible({ method: 'getHealth' }).eligible.map((r) => r.id)).toContain(id);
  });
});

describe('ranking', () => {
  it('prefers the faster provider', () => {
    const fast = idOf(SDF_STYLE);
    registry.recordSuccess(fast, { method: 'getLatestLedger', latencyMs: 50 });
    for (const s of samples) {
      if (idOf(s.url) !== fast) registry.recordSuccess(idOf(s.url), { method: 'getLatestLedger', latencyMs: 2_000 });
    }
    expect(registry.eligible({ method: 'getLatestLedger' }).eligible[0]?.id).toBe(fast);
  });

  it('is deterministic for identical observations', () => {
    const a = registry.eligible({ method: 'getLatestLedger' }).eligible.map((r) => r.id);
    const b = registry.eligible({ method: 'getLatestLedger' }).eligible.map((r) => r.id);
    expect(a).toEqual(b);
  });
});

describe('snapshot', () => {
  it('round-trips through JSON without losing routing behaviour', () => {
    const json = JSON.stringify(registry.snapshot());
    const restored = ProviderRegistry.restore(JSON.parse(json), { now: () => now });
    const req = { method: 'getEvents', startLedger: latest() - 3 * LEDGERS_PER_DAY };
    expect(restored.eligible(req).eligible.map((r) => r.id)).toEqual(
      registry.eligible(req).eligible.map((r) => r.id),
    );
  });
});
