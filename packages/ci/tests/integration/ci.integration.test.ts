import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, runChecks } from '../../src';

// Real testnet, real deployed fixture contract, real baselines written to disk.
const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../test-utils/fixtures/fixture-contract.json'), 'utf8'),
) as { contractId: string };
const WASM = resolve(
  __dirname,
  '../../../test-utils/fixture-contract/target/wasm32v1-none/release/soroscope_fixture_contract.wasm',
);

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'soroscope-ci-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(name: string, config: Record<string, unknown>): ReturnType<typeof loadConfig> {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify({ version: 1, baseline: `${name}.baseline.json`, ...config }));
  return loadConfig(path);
}

const deployed = (extra: Record<string, unknown>): Record<string, unknown> => ({
  contractId: FIXTURE.contractId,
  ...extra,
});

describe('Mode A: measure a deployed contract and catch a real regression', () => {
  it('records a baseline, passes against itself, then fails when the work grows', { timeout: 120_000 }, async () => {
    const before = writeConfig('regress.json', {
      invocations: [{ name: 'work', ...deployed({ function: 'work', args: { n: 10 } }) }],
    });
    const recorded = await runChecks({ loaded: before, updateBaseline: true });
    expect(recorded.baselineWritten).toBe(true);
    expect(recorded.report.invocations[0]!.status).toBe('new');

    const same = await runChecks({ loaded: before });
    expect(same.report.result).toBe('pass');

    // Same invocation name, a hundred times the work: a real difference, not an edited number.
    const after = writeConfig('regress.json', {
      invocations: [{ name: 'work', ...deployed({ function: 'work', args: { n: 5000 } }) }],
    });
    const grown = await runChecks({ loaded: after });
    expect(grown.report.result).toBe('fail');
    const finding = grown.report.invocations[0]!.findings.find((f) => f.metric === 'instructions')!;
    expect(finding.level).toBe('fail');
    expect(finding.deltaPct!).toBeGreaterThan(5);
  });

  it('catches a growing ledger footprint', { timeout: 120_000 }, async () => {
    const one = writeConfig('footprint.json', {
      invocations: [{ name: 'touch', ...deployed({ function: 'touch', args: { n: 1 } }) }],
    });
    await runChecks({ loaded: one, updateBaseline: true });
    const five = writeConfig('footprint.json', {
      invocations: [{ name: 'touch', ...deployed({ function: 'touch', args: { n: 5 } }) }],
    });
    const r = await runChecks({ loaded: five });
    expect(r.report.result).toBe('fail');
    const msgs = r.report.invocations[0]!.findings.filter((f) => f.metric === 'footprint').map((f) => f.message);
    expect(msgs.some((m) => m.includes('new ledger entry'))).toBe(true);
  });

  it('checks expected failures by contract error name', { timeout: 120_000 }, async () => {
    const cfg = writeConfig('failures.json', {
      invocations: [
        { name: 'insufficient', ...deployed({ function: 'fail_with', args: { code: 2 }, expect: { success: false, errorName: 'InsufficientFunds' } }) },
        { name: 'wrong-name', ...deployed({ function: 'fail_with', args: { code: 2 }, expect: { success: false, errorName: 'NotFound' } }) },
        { name: 'should-succeed', ...deployed({ function: 'fail_with', args: { code: 4 } }) },
      ],
    });
    const r = await runChecks({ loaded: cfg });
    const by = Object.fromEntries(r.report.invocations.map((i) => [i.name, i]));
    expect(by['insufficient']!.findings.filter((f) => f.level === 'fail')).toEqual([]);
    expect(by['wrong-name']!.status).toBe('fail');
    expect(by['should-succeed']!.status).toBe('fail');
  });

  it('works on a Stellar Asset Contract with typed arguments', { timeout: 120_000 }, async () => {
    const cfg = writeConfig('sac.json', {
      invocations: [
        {
          name: 'native.symbol',
          contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
          function: 'symbol',
        },
        {
          name: 'native.balance',
          contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
          function: 'balance',
          args: [{ type: 'address', value: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR' }],
        },
      ],
    });
    const r = await runChecks({ loaded: cfg, updateBaseline: true });
    expect(r.report.invocations.every((i) => i.measurement.ok)).toBe(true);
    expect(r.report.invocations[0]!.measurement.returnValue).toBe('"native"');
  });
});

describe('Mode B: measure this build of the contract, deployed fresh', () => {
  it('is deterministic across two independent deployments', { timeout: 600_000 }, async () => {
    const config = {
      contracts: {
        fixture: { wasm: WASM, setup: [{ function: 'init', args: { admin: '$deployer' } }] },
      },
      invocations: [
        { name: 'work', contract: 'fixture', function: 'work', args: { n: 100 } },
        { name: 'touch', contract: 'fixture', function: 'touch', args: { n: 2 } },
        { name: 'mint', contract: 'fixture', function: 'mint', args: { to: '$deployer', amount: 5 }, source: '$deployer' },
      ],
    };
    const cfg = writeConfig('modeb.json', config);
    const first = await runChecks({ loaded: cfg, updateBaseline: true });
    expect(Object.keys(first.deployed)).toEqual(['fixture']);

    // A second, completely separate deployment (new deployer, new contract id).
    const second = await runChecks({ loaded: cfg });
    expect(second.deployed['fixture']!.contractId).not.toBe(first.deployed['fixture']!.contractId);
    // Same code, same behaviour: instructions and footprints must match exactly, even though
    // every contract id and account differs.
    expect(second.report.invocations.map((i) => ({ name: i.name, status: i.status, findings: i.findings.map((f) => f.message) }))).toEqual([
      { name: 'work', status: 'pass', findings: [] },
      { name: 'touch', status: 'pass', findings: [] },
      { name: 'mint', status: 'pass', findings: [] },
    ]);
    const fp = second.report.invocations.find((i) => i.name === 'touch')!.measurement.footprint!;
    expect(fp.readWrite.every((k) => !k.includes(second.deployed['fixture']!.contractId))).toBe(true);
    expect(fp.readWrite.some((k) => k.includes('$fixture'))).toBe(true);

    const baseline = JSON.parse(readFileSync(first.baselinePath, 'utf8')) as { entries: Record<string, { wasmSha256: string }> };
    expect(baseline.entries['work']!.wasmSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to deploy on mainnet', async () => {
    const cfg = writeConfig('mainnet.json', {
      network: { name: 'mainnet' },
      contracts: { fixture: { wasm: WASM } },
      invocations: [{ name: 'x', contract: 'fixture', function: 'work', args: { n: 1 } }],
    });
    await expect(runChecks({ loaded: cfg })).rejects.toThrow(/only done on testnet/);
  });
});
