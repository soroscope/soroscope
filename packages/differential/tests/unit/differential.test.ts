import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeSimulationResponse, type RawSimulateResponse } from '@soroscope/core';
import { describe, expect, it } from 'vitest';
import {
  compareProviders,
  describeDifferential,
  differentialSimulate,
  type ProviderAnswer,
} from '../../src';

interface Recording {
  calls: {
    name: string;
    transaction: string;
    answers: { provider: string; latencyMs: number; raw?: RawSimulateResponse; failure?: string }[];
  }[];
}
// What five real public mainnet providers answered to the same simulated calls at the same
// moment, recorded by packages/test-utils/scripts/record-differential.mjs.
const recording = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/provider-answers.json'), 'utf8'),
) as Recording;
// A real failed simulation, recorded from testnet (core's fixtures).
const coreFixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../core/tests/fixtures/soroban-xdr.json'), 'utf8'),
) as {
  simulations: { name: string; response: RawSimulateResponse }[];
};

const answer = (provider: string, raw: RawSimulateResponse, latencyMs = 100): ProviderAnswer => ({
  provider,
  latencyMs,
  latestLedger: raw.latestLedger,
  report: decodeSimulationResponse(raw),
});
const answersOf = (callName: string): ProviderAnswer[] =>
  recording.calls
    .find((c) => c.name === callName)!
    .answers.map((a) =>
      a.raw === undefined
        ? { provider: a.provider, latencyMs: a.latencyMs, failure: a.failure ?? 'no answer' }
        : answer(a.provider, a.raw, a.latencyMs),
    );

describe('real providers asked the same question', () => {
  it('recorded five providers answering every call', () => {
    for (const c of recording.calls)
      expect(c.answers.filter((a) => a.raw !== undefined)).toHaveLength(5);
  });

  // This is a measurement, not a hope: on this recording the public mainnet providers agree,
  // including on a DEX quote that moves with every trade. If a re-recording finds a
  // disagreement, that is a finding to read, not a test to loosen.
  it.each(recording.calls.map((c) => c.name))('agree on: %s', (name) => {
    const report = compareProviders(answersOf(name));
    expect(report.compared).toBe(5);
    expect(report.disagreements).toEqual([]);
    expect(describeDifferential(report)).toContain('No disagreement');
  });
});

// The providers above did not disagree, so these pair REAL responses to DIFFERENT calls under
// provider names, to exercise the grouping. They show what the report says when providers
// differ; they are not providers disagreeing.
describe('grouping, when providers differ', () => {
  const sim = (prefix: string): RawSimulateResponse =>
    coreFixture.simulations.find((s) => s.name.startsWith(prefix))!.response;
  const A = 'https://a.example',
    B = 'https://b.example',
    C = 'https://c.example';

  it('names the field, groups providers by value and puts the larger group first', () => {
    const name = sim('name'),
      decimals = sim('decimals');
    const report = compareProviders([answer(A, name), answer(B, name), answer(C, decimals)]);
    const rv = report.disagreements.find((d) => d.field === 'returnValue')!;
    expect(rv.groups).toEqual([
      { value: '"native"', providers: [A, B] },
      { value: '7', providers: [C] },
    ]);
  });

  it('flags ledger skew when providers answered at different ledgers', () => {
    const name = sim('name'),
      decimals = sim('decimals');
    const skewed = compareProviders([
      answer(A, name),
      answer(B, { ...decimals, latestLedger: name.latestLedger + 3 }),
    ]);
    expect(skewed.disagreements.every((d) => d.ledgerSkew)).toBe(true);
    // (Recorded at different times, so pin the ledger to compare like with like.)
    const same = compareProviders([
      answer(A, name),
      answer(B, { ...decimals, latestLedger: name.latestLedger }),
    ]);
    expect(same.disagreements.every((d) => !d.ledgerSkew)).toBe(true);
  });

  it('reports only the outcome when one provider succeeds and another fails', () => {
    const report = compareProviders([answer(A, sim('name')), answer(B, sim('transfer exceeding'))]);
    expect(report.disagreements.map((d) => d.field)).toEqual(['outcome']);
  });

  it('leaves a provider that did not answer out of the comparison, and says so', () => {
    const name = sim('name');
    const report = compareProviders([
      answer(A, name),
      answer(B, name),
      { provider: C, latencyMs: 30000, failure: 'timeout' },
    ]);
    expect(report.compared).toBe(2);
    expect(report.disagreements).toEqual([]);
    expect(describeDifferential(report)).toContain('2 of 3 providers answered');
    expect(describeDifferential(report)).toContain('timeout');
  });

  it('says there is nothing to compare when fewer than two answered', () => {
    const report = compareProviders([
      answer(A, sim('name')),
      { provider: B, latencyMs: 5, failure: 'refused' },
    ]);
    expect(describeDifferential(report)).toContain('nothing to compare');
  });
});

describe('differentialSimulate against providers that cannot answer', () => {
  it('reports a real refused connection as a failure, not a disagreement', async () => {
    // Nothing listens on port 9 (discard): a genuine connection failure, no network needed.
    const report = await differentialSimulate(recording.calls[0]!.transaction, {
      providers: ['http://127.0.0.1:9', 'http://127.0.0.1:1'],
      timeoutMs: 3000,
    });
    expect(report.compared).toBe(0);
    expect(report.answers.map((a) => a.failure !== undefined)).toEqual([true, true]);
    expect(report.disagreements).toEqual([]);
  }, 20_000);
});
