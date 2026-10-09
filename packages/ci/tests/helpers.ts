import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeSimulationResponse } from '@soroscope/core';
import type { RawSimulateResponse } from '@soroscope/core';
import { measure } from '../src';
import type { Measurement, NumericMetrics } from '../src';

interface Fixture {
  simulations: { name: string; response: RawSimulateResponse }[];
}

// A real simulation recorded from the live testnet (see packages/test-utils/scripts/record-soroban.mjs).
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../core/tests/fixtures/soroban-xdr.json'), 'utf8'),
) as Fixture;

/** The measurement of a real recorded simulation. */
export function realMeasurement(namePrefix = 'transfer needing auth'): Measurement {
  const sim = fixture.simulations.find((s) => s.name.startsWith(namePrefix));
  if (sim === undefined) throw new Error(`no recorded simulation "${namePrefix}"`);
  return measure(decodeSimulationResponse(sim.response));
}

/** The real measurement with chosen numeric metrics replaced: for exercising comparison thresholds. */
export function withMetrics(base: Measurement, patch: Partial<NumericMetrics>): Measurement {
  if (base.metrics === null) throw new Error('measurement has no metrics');
  return { ...base, metrics: { ...base.metrics, ...patch } };
}

/** `value` grown by `pct` percent, as the string metrics use. */
export function grow(value: string, pct: number): string {
  return (BigInt(value) + (BigInt(value) * BigInt(Math.round(pct * 100))) / 10000n).toString();
}
