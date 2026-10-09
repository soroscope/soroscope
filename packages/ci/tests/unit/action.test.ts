import { describe, expect, it } from 'vitest';
import { annotations, compareAll, parseConfig, readInputs } from '../../src';
import { realMeasurement, withMetrics, grow } from '../helpers';

describe('Action inputs', () => {
  it('apply defaults', () => {
    expect(readInputs({})).toEqual({
      config: 'soroscope.config.json',
      updateBaseline: false,
      githubToken: '',
      comment: true,
      failOn: 'regression',
      deployerSecret: '',
      workingDirectory: '.',
    });
  });

  it('read GitHub-style INPUT_ variables, dashes kept', () => {
    const i = readInputs({ INPUT_CONFIG: 'x.json', 'INPUT_UPDATE-BASELINE': 'true', 'INPUT_FAIL-ON': 'warning', 'INPUT_GITHUB-TOKEN': ' t ' });
    expect(i).toMatchObject({ config: 'x.json', updateBaseline: true, failOn: 'warning', githubToken: 't' });
  });

  it('reject an unknown fail-on value', () => {
    expect(() => readInputs({ 'INPUT_FAIL-ON': 'sometimes' })).toThrow(/regression, warning or never/);
  });
});

describe('annotations', () => {
  it('turn failures into errors and warnings into warnings, escaping newlines', () => {
    const REAL = realMeasurement();
    const cfg = parseConfig({
      version: 1,
      invocations: [{ name: 'multi\nline', contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', function: 'transfer' }],
    });
    const base = { version: 1 as const, generatedAt: '', tool: '', environment: { network: 'testnet', protocolVersion: 29 }, entries: { 'multi\nline': { ...REAL, function: 'transfer' } } };
    const grown = withMetrics(REAL, { instructions: grow(REAL.metrics!.instructions, 50), resourceFee: grow(REAL.metrics!.resourceFee, 50) });
    const report = compareAll({
      config: cfg,
      measurements: { 'multi\nline': { function: 'transfer', measurement: grown } },
      baseline: base,
      environment: { network: 'testnet', protocolVersion: 29 },
    });
    const lines = annotations(report);
    expect(lines.some((l) => l.startsWith('::error '))).toBe(true);
    expect(lines.some((l) => l.startsWith('::warning '))).toBe(true);
    expect(lines.every((l) => !l.includes('\n'))).toBe(true);
    expect(lines.join('')).toContain('multi%0Aline');
  });
});
