import { describe, expect, it } from 'vitest';
import { compareAll, parseConfig, renderMarkdown, renderText, stableStringify, COMMENT_MARKER } from '../../src';
import type { Baseline, Measurement, SoroscopeConfig } from '../../src';
import { grow, realMeasurement, withMetrics } from '../helpers';

// Every measurement here starts from a REAL recorded simulation; tests change one number at a
// time to probe a rule, which is the point of a threshold test.
const REAL = realMeasurement();
const ENV = { network: 'testnet', protocolVersion: 29 };
const CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const config = (extra: Record<string, unknown> = {}, invocation: Record<string, unknown> = {}): SoroscopeConfig =>
  parseConfig({
    version: 1,
    invocations: [{ name: 'call', contractId: CONTRACT, function: 'transfer', ...invocation }],
    ...extra,
  });

const baselineOf = (m: Measurement, env = ENV): Baseline => ({
  version: 1,
  generatedAt: '2026-10-09T00:00:00.000Z',
  tool: 'test',
  environment: env,
  entries: { call: { ...m, function: 'transfer' } },
});

const run = (cfg: SoroscopeConfig, current: Measurement, base: Baseline | null, env = ENV) =>
  compareAll({ config: cfg, measurements: { call: { function: 'transfer', measurement: current } }, baseline: base, environment: env });

describe('the real measurement', () => {
  it('has resources and a footprint to compare', () => {
    expect(REAL.ok).toBe(true);
    expect(BigInt(REAL.metrics!.instructions)).toBeGreaterThan(0n);
    expect(REAL.footprint!.readWrite.length).toBeGreaterThan(0);
  });
});

describe('thresholds', () => {
  const base = baselineOf(REAL);

  it('identical numbers pass with no findings', () => {
    const r = run(config(), REAL, base);
    expect(r.result).toBe('pass');
    expect(r.invocations[0]!.findings).toEqual([]);
  });

  it('instructions up 4% pass, up 6% fail (default 5%)', () => {
    const ok = run(config(), withMetrics(REAL, { instructions: grow(REAL.metrics!.instructions, 4) }), base);
    expect(ok.result).toBe('pass');
    const bad = run(config(), withMetrics(REAL, { instructions: grow(REAL.metrics!.instructions, 6) }), base);
    expect(bad.result).toBe('fail');
    const f = bad.invocations[0]!.findings.find((x) => x.metric === 'instructions')!;
    expect(f.level).toBe('fail');
    expect(f.deltaPct).toBeGreaterThan(5);
  });

  it('a custom threshold widens the tolerance', () => {
    const cfg = config({ thresholds: { instructions: { maxIncreasePct: 20 } } });
    expect(run(cfg, withMetrics(REAL, { instructions: grow(REAL.metrics!.instructions, 15) }), base).result).toBe('pass');
  });

  it('an absolute allowance is added to the percentage', () => {
    const cfg = config({ thresholds: { instructions: { maxIncreasePct: 0, maxIncreaseAbs: 1000 } } });
    const plus = (n: number): string => (BigInt(REAL.metrics!.instructions) + BigInt(n)).toString();
    expect(run(cfg, withMetrics(REAL, { instructions: plus(1000) }), base).result).toBe('pass');
    expect(run(cfg, withMetrics(REAL, { instructions: plus(1001) }), base).result).toBe('fail');
  });

  it('resource fee growth only warns by default', () => {
    const r = run(config(), withMetrics(REAL, { resourceFee: grow(REAL.metrics!.resourceFee, 30) }), base);
    expect(r.result).toBe('warn');
    expect(r.invocations[0]!.findings[0]!.level).toBe('warn');
  });

  it('a metric can be ignored entirely', () => {
    const cfg = config({ thresholds: { resourceFee: { level: 'ignore' } } });
    expect(run(cfg, withMetrics(REAL, { resourceFee: grow(REAL.metrics!.resourceFee, 300) }), base).result).toBe('pass');
  });

  it('a large improvement is reported as information, not a problem', () => {
    const r = run(config(), withMetrics(REAL, { instructions: grow(REAL.metrics!.instructions, -30) }), base);
    expect(r.result).toBe('pass');
    expect(r.invocations[0]!.findings[0]).toMatchObject({ level: 'info', metric: 'instructions' });
  });
});

describe('footprint', () => {
  const base = baselineOf(REAL);
  const extraKey = 'contractData:persistent:CEXTRA:[:Balance]';

  it('a new read-write ledger entry fails', () => {
    const cur: Measurement = { ...REAL, footprint: { ...REAL.footprint!, readWrite: [...REAL.footprint!.readWrite, extraKey] } };
    const r = run(config(), cur, base);
    expect(r.result).toBe('fail');
    expect(r.invocations[0]!.findings.find((f) => f.metric === 'footprint')!.message).toContain('new ledger entry');
  });

  it('...unless new keys are allowed', () => {
    const cur: Measurement = { ...REAL, footprint: { ...REAL.footprint!, readWrite: [...REAL.footprint!.readWrite, extraKey] } };
    const r = run(config({ thresholds: { footprint: { allowNewKeys: true } } }), cur, base);
    expect(r.result).toBe('pass');
  });

  it('an entry that was read-only becoming read-write fails', () => {
    const promoted = REAL.footprint!.readOnly[0]!;
    const cur: Measurement = {
      ...REAL,
      footprint: { readOnly: REAL.footprint!.readOnly.slice(1), readWrite: [...REAL.footprint!.readWrite, promoted] },
    };
    const r = run(config(), cur, base);
    expect(r.result).toBe('fail');
    expect(r.invocations[0]!.findings.find((f) => f.metric === 'footprint')!.message).toContain('only read before');
  });

  it('a new read-only entry only warns; a dropped entry is information', () => {
    const cur: Measurement = {
      ...REAL,
      footprint: { readOnly: [...REAL.footprint!.readOnly, 'contractCode:abc'], readWrite: REAL.footprint!.readWrite.slice(1) },
    };
    const r = run(config(), cur, base);
    expect(r.result).toBe('warn');
    expect(r.invocations[0]!.findings.map((f) => f.level)).toEqual(expect.arrayContaining(['warn', 'info']));
  });
});

describe('budgets, outcomes and baselines', () => {
  it('an absolute budget fails even with no baseline', () => {
    const cfg = config({ budgets: { instructions: 1 } });
    const r = run(cfg, REAL, null);
    expect(r.result).toBe('fail');
    expect(r.invocations[0]!.findings.some((f) => f.metric === 'instructions' && f.level === 'fail')).toBe(true);
  });

  it('with no baseline an invocation is "new" and only warns', () => {
    const r = run(config(), REAL, null);
    expect(r.invocations[0]!.status).toBe('new');
    expect(r.result).toBe('warn');
  });

  it('failOnMissingBaseline turns that into a failure', () => {
    const r = run(config({ failOnMissingBaseline: true }), REAL, null);
    expect(r.result).toBe('fail');
  });

  it('an unexpected failure fails the check', () => {
    const failed: Measurement = { ok: false, errorName: 'InsufficientFunds', metrics: null, footprint: null, returnValue: null, ledger: 1 };
    const r = run(config(), failed, baselineOf(REAL));
    expect(r.result).toBe('fail');
    expect(r.invocations[0]!.findings[0]!.message).toContain('InsufficientFunds');
  });

  it('an expected failure with the right error name passes', () => {
    const failed: Measurement = { ok: false, errorName: 'InsufficientFunds', metrics: null, footprint: null, returnValue: null, ledger: 1 };
    const cfg = config({}, { expect: { success: false, errorName: 'InsufficientFunds' } });
    expect(run(cfg, failed, null).invocations[0]!.findings).toEqual([]);
  });

  it('an expected failure with the wrong error name fails', () => {
    const failed: Measurement = { ok: false, errorName: 'Invalid', metrics: null, footprint: null, returnValue: null, ledger: 1 };
    const cfg = config({}, { expect: { success: false, errorName: 'InsufficientFunds' } });
    expect(run(cfg, failed, null).result).toBe('fail');
  });

  it('a call expected to fail that succeeds fails', () => {
    const cfg = config({}, { expect: { success: false } });
    expect(run(cfg, REAL, baselineOf(REAL)).result).toBe('fail');
  });

  it('a protocol change turns a resource-fee failure into a warning', () => {
    const cfg = config({ thresholds: { resourceFee: { level: 'fail' } } });
    const cur = withMetrics(REAL, { resourceFee: grow(REAL.metrics!.resourceFee, 50) });
    expect(run(cfg, cur, baselineOf(REAL)).result).toBe('fail');
    const r = run(cfg, cur, baselineOf(REAL, { network: 'testnet', protocolVersion: 25 }));
    expect(r.environmentChanged).toBe(true);
    expect(r.result).toBe('warn');
  });

  it('lists baseline entries that no longer have an invocation', () => {
    const base = baselineOf(REAL);
    base.entries['gone'] = base.entries['call']!;
    expect(run(config(), REAL, base).removed).toEqual(['gone']);
  });
});

describe('config validation', () => {
  it('rejects unknown fields, bad versions, duplicates and dangling aliases', () => {
    expect(() => parseConfig({ version: 2, invocations: [] })).toThrow();
    expect(() => parseConfig({ version: 1, surprise: true, invocations: [{ name: 'a', contractId: CONTRACT, function: 'f' }] })).toThrow(/surprise|Unrecognized/);
    expect(() => parseConfig({ version: 1, invocations: [{ name: 'a', contractId: CONTRACT, function: 'f' }, { name: 'a', contractId: CONTRACT, function: 'g' }] })).toThrow(/used twice/);
    expect(() => parseConfig({ version: 1, invocations: [{ name: 'a', contract: 'missing', function: 'f' }] })).toThrow(/not defined under contracts/);
    expect(() => parseConfig({ version: 1, invocations: [{ name: 'a', function: 'f' }] })).toThrow(/exactly one/);
  });
});

describe('reports', () => {
  const failing = run(config({ budgets: { instructions: 1 } }), REAL, baselineOf(REAL));

  it('markdown starts with the marker the Action uses to update its own comment', () => {
    const md = renderMarkdown(failing);
    expect(md.startsWith(COMMENT_MARKER)).toBe(true);
    expect(md).toContain('FAIL');
    expect(md).toContain('| call | instructions |');
  });

  it('untrusted text cannot break out of the table or inject HTML', () => {
    const cfg = config({}, { name: 'evil | name <script>alert(1)</script>' });
    const r = compareAll({
      config: cfg,
      measurements: { 'evil | name <script>alert(1)</script>': { function: 'f', measurement: REAL } },
      baseline: null,
      environment: ENV,
    });
    const md = renderMarkdown(r);
    expect(md).not.toContain('<script>');
    expect(md).toContain('evil \\| name &lt;script>');
  });

  it('plain text report summarises the result', () => {
    expect(renderText(failing)).toMatch(/Result: FAIL/);
  });
});

describe('baseline files', () => {
  it('serialise with sorted keys so diffs show only real changes', () => {
    const a = stableStringify({ b: 1, a: { d: 2, c: 3 } });
    expect(a).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');
  });
});
