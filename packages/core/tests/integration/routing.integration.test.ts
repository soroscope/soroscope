import { describe, expect, it } from 'vitest';
import {
  NETWORK_PASSPHRASES,
  NoEligibleProviderError,
  RpcClient,
  RpcHttpError,
  RpcNetworkError,
  RpcResponseError,
  RpcTimeoutError,
  SoroscopeRouter,
  classifyFailure,
  probeProviders,
  publicProviderUrls,
  toJson,
  toPrometheus,
  toTable,
} from '../../src';

// These tests talk to the real Stellar testnet. Nothing is stubbed.
const TESTNET = publicProviderUrls('testnet');
const SDF = 'https://soroban-testnet.stellar.org';

describe('RpcClient against a live endpoint', () => {
  const client = new RpcClient({ url: SDF });

  it('reads getHealth with transport details', async () => {
    const raw = await client.callRaw<{ status: string; latestLedger: number; oldestLedger: number }>(
      'getHealth',
    );
    expect(raw.httpStatus).toBe(200);
    expect(raw.result.status).toBe('healthy');
    expect(raw.result.latestLedger).toBeGreaterThan(raw.result.oldestLedger);
    expect(raw.latencyMs).toBeGreaterThan(0);
  });

  it('reports the network it serves', async () => {
    const net = await client.call<{ passphrase: string }>('getNetwork');
    expect(net.passphrase).toBe(NETWORK_PASSPHRASES.testnet);
  });
});

describe('real failure modes', () => {
  it('DNS failure -> RpcNetworkError', async () => {
    const err = await new RpcClient({ url: 'https://nonexistent.invalid' })
      .call('getHealth')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcNetworkError);
    expect(classifyFailure(err)).toBe('network');
  });

  it('refused connection -> RpcNetworkError', async () => {
    const err = await new RpcClient({ url: 'http://127.0.0.1:1' })
      .call('getHealth')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcNetworkError);
  });

  it('1ms budget -> RpcTimeoutError', async () => {
    const err = await new RpcClient({ url: SDF, timeoutMs: 1 })
      .call('getHealth')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcTimeoutError);
    expect(classifyFailure(err)).toBe('timeout');
  });

  it('bad path -> RpcHttpError 404, classified as misconfigured', async () => {
    const err = await new RpcClient({ url: `${SDF}/nope` }).call('getHealth').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcHttpError);
    expect((err as RpcHttpError).status).toBe(404);
    expect(classifyFailure(err)).toBe('misconfigured');
  });

  it('a ledger below the retention window -> out_of_retention with the real range', async () => {
    const err = await new RpcClient({ url: SDF })
      .call('getEvents', { startLedger: 1000, filters: [], pagination: { limit: 1 } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcResponseError);
    expect(classifyFailure(err)).toBe('out_of_retention');
  });
});

describe('SoroscopeRouter against live providers', () => {
  it('learns ledger bounds and chain identity before the first call', async () => {
    const router = await SoroscopeRouter.create({ providers: TESTNET });
    const recs = router.registry.list();
    expect(recs).toHaveLength(TESTNET.length);
    const sdf = recs.find((r) => r.url === SDF);
    expect(sdf?.ledger.latest).toBeGreaterThan(0);
    expect(sdf?.ledger.retentionWindow).toBeGreaterThan(0);
    expect(sdf?.chain.passphrase).toBe(NETWORK_PASSPHRASES.testnet);
  });

  it('routes a call and reports which provider answered', async () => {
    const router = await SoroscopeRouter.create({ providers: TESTNET });
    const out = await router.callDetailed<{ sequence: number }>('getLatestLedger');
    expect(out.result.sequence).toBeGreaterThan(0);
    expect(TESTNET.some((u) => u.includes(out.provider))).toBe(true);
    expect(out.attempts.at(-1)?.ok).toBe(true);
  });

  it('fails over from a dead provider to a live one and records both attempts', async () => {
    // No refresh: the dead provider has no history, so it is tried first by tie-break.
    const router = new SoroscopeRouter({ providers: ['http://127.0.0.1:1', SDF] });
    const out = await router.callDetailed<{ sequence: number }>('getLatestLedger');
    expect(out.result.sequence).toBeGreaterThan(0);
    expect(out.attempts).toHaveLength(2);
    expect(out.attempts[0]).toMatchObject({ ok: false, failure: 'network' });
    expect(out.attempts[1]).toMatchObject({ ok: true });
  });

  it('refuses to route a request no provider retains, naming each reason', async () => {
    const router = await SoroscopeRouter.create({ providers: TESTNET });
    const err = await router
      .call('getEvents', { startLedger: 1000, filters: [], pagination: { limit: 1 } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NoEligibleProviderError);
    expect((err as NoEligibleProviderError).excluded.length).toBe(TESTNET.length);
  });

  it('explain() agrees with what call() does, without a network round trip', async () => {
    const router = await SoroscopeRouter.create({ providers: TESTNET });
    const plan = router.explain('getLatestLedger');
    const out = await router.callDetailed('getLatestLedger');
    expect(plan.ranking.length).toBeGreaterThan(0);
    expect(plan.chosen).toBeDefined();
    expect(out.provider).toBe(plan.chosen);
  });

  it('fanOut reports every provider', async () => {
    const router = await SoroscopeRouter.create({ providers: TESTNET });
    const all = await router.fanOut<{ status: string }>('getHealth');
    expect(all).toHaveLength(TESTNET.length);
    expect(all.some((r) => r.ok)).toBe(true);
  });
});

describe('probeProviders against live providers', () => {
  it('measures latency, ledger lag, retention and chain identity', async () => {
    const report = await probeProviders(TESTNET, { samples: 3, reach: false });
    expect(report.providers).toHaveLength(TESTNET.length);
    const sdf = report.providers.find((p) => p.url === SDF);
    expect(sdf?.reachable).toBe(true);
    expect(sdf?.latency.p50Ms).toBeGreaterThan(0);
    expect(sdf?.passphrase).toBe(NETWORK_PASSPHRASES.testnet);
    expect(sdf?.ledger.advertisedDays).toBeGreaterThan(1);
    expect(report.summary.maxLatestLedger).toBeGreaterThan(0);
  });

  it('renders the same report as JSON, Prometheus text and a table', async () => {
    const report = await probeProviders([SDF, 'http://127.0.0.1:1'], { samples: 2, reach: false });
    expect((JSON.parse(toJson(report)) as { providers: unknown[] }).providers).toHaveLength(2);

    const prom = toPrometheus(report, 'testnet');
    expect(prom).toMatch(/^# TYPE soroscope_provider_up gauge$/m);
    expect(prom).toContain('soroscope_provider_up{provider="soroban-testnet.stellar.org",network="testnet"} 1');
    expect(prom).toContain('soroscope_provider_up{provider="127.0.0.1:1",network="testnet"} 0');
    // The dead provider has no latency, so no latency series is emitted for it.
    expect(prom).not.toMatch(/latency_p50_ms\{provider="127\.0\.0\.1:1"/);
    expect(prom.endsWith('\n')).toBe(true);

    const table = toTable(report);
    expect(table.split('\n')[0]).toMatch(/^PROVIDER\s+STATUS\s+P50/);
    expect(table).toContain('unreachable');
  });

  it('marks a dead endpoint unreachable instead of throwing', async () => {
    const report = await probeProviders([SDF, 'http://127.0.0.1:1'], { samples: 1, reach: false });
    const dead = report.providers.find((p) => p.url === 'http://127.0.0.1:1');
    expect(dead?.status).toBe('unreachable');
    expect(dead?.failure?.class).toBe('network');
    expect(report.summary.healthy).toBe(1);
  });

  it('measures how far back getLedgers really reaches', async () => {
    const report = await probeProviders([SDF], { samples: 1 });
    const p = report.providers[0]!;
    expect(p.reach.lookups).toBeGreaterThan(0);
    expect(p.reach.getLedgersOldest).not.toBeNull();
    // Testnet retains about a week; reach cannot be shorter than that.
    expect(p.reach.getLedgersDays!).toBeGreaterThan(5);
  });
});
