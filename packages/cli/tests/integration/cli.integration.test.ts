import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const BIN = resolve(__dirname, '../../dist/bin.js');

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

/** Spawn the built `soroscope` binary for real and capture what it prints. */
async function soroscope(...args: string[]): Promise<Result> {
  try {
    const { stdout, stderr } = await run(process.execPath, [BIN, ...args], { timeout: 100_000 });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: typeof e.code === 'number' ? e.code : 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('soroscope probe (built binary, live testnet)', () => {
  it('prints a table and exits 0', async () => {
    const r = await soroscope('probe', '--network', 'testnet', '--samples', '2', '--no-reach');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/PROVIDER\s+STATUS/);
    expect(r.stdout).toContain('soroban-testnet.stellar.org');
  });

  it('emits parseable JSON with real ledger numbers', async () => {
    const r = await soroscope('probe', '--network', 'testnet', '--samples', '2', '--no-reach', '--format', 'json');
    expect(r.code).toBe(0);
    const report = JSON.parse(r.stdout) as {
      providers: { provider: string; ledger: { latest: number }; passphrase: string }[];
    };
    expect(report.providers.length).toBeGreaterThan(0);
    expect(report.providers[0]!.ledger.latest).toBeGreaterThan(1_000_000);
    expect(report.providers[0]!.passphrase).toBe('Test SDF Network ; September 2015');
  });

  it('emits Prometheus exposition text', async () => {
    const r = await soroscope('probe', '--network', 'testnet', '--samples', '2', '--no-reach', '--format', 'prometheus');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^# TYPE soroscope_provider_up gauge$/m);
    expect(r.stdout).toMatch(/soroscope_provider_up\{provider="[^"]+",network="testnet"\} 1/);
  });

  it('exits 3 when no provider is reachable', async () => {
    const r = await soroscope('probe', '--rpc', 'http://127.0.0.1:1', '--samples', '1', '--no-reach');
    expect(r.code).toBe(3);
  });

  it('exits 1 under --strict when any provider is unhealthy', async () => {
    const r = await soroscope(
      'probe', '--rpc', 'https://soroban-testnet.stellar.org', '--rpc', 'http://127.0.0.1:1',
      '--samples', '1', '--no-reach', '--strict',
    );
    expect(r.code).toBe(1);
  });

  it('exits 2 on bad usage', async () => {
    expect((await soroscope('probe', '--network', 'bogus')).code).toBe(2);
    expect((await soroscope('probe', '--samples', '0')).code).toBe(2);
    expect((await soroscope('probe', '--format', 'xml')).code).toBe(2);
  });
});

describe('soroscope route-explain (built binary, live testnet)', () => {
  it('names a provider for a recent call and excludes none that can serve it', async () => {
    const r = await soroscope('route-explain', 'getLatestLedger', '--network', 'testnet');
    expect(r.code).toBe(0);
    const plan = JSON.parse(r.stdout) as { chosen: string; ranking: unknown[] };
    expect(plan.chosen).toBeTruthy();
    expect(plan.ranking.length).toBeGreaterThan(0);
  });

  it('exits 3 and says why when no provider retains the ledger', async () => {
    const r = await soroscope('route-explain', 'getEvents', '--network', 'testnet', '--start-ledger', '1000');
    expect(r.code).toBe(3);
    const plan = JSON.parse(r.stdout) as { chosen?: string; excluded: { reason: string }[] };
    expect(plan.chosen).toBeUndefined();
    expect(plan.excluded.some((e) => /older than its oldest servable ledger/.test(e.reason))).toBe(true);
  });
});
