import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RawSimulateResponse } from '@soroscope/core';
import type { NetworkConfigSnapshot } from '../../src';

/** tests/fixtures/engine-parity.json, recorded by packages/test-utils/scripts/record-engine-parity.mjs. */
export interface ParityFixture extends NetworkConfigSnapshot {
  provenance: { tool: string; recordedAt: string };
  v1Wasm: string;
  v2Wasm: string;
  live: { contractId: string; wasmHash: string; invoker: string };
  calls: { fn: string; args: string[]; live: RawSimulateResponse }[];
}

export const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/engine-parity.json'), 'utf8'),
) as ParityFixture;

export const v1Wasm = Buffer.from(fixture.v1Wasm, 'base64');
export const v2Wasm = Buffer.from(fixture.v2Wasm, 'base64');

/** Seconds since the epoch at the time of recording: the local ledger starts there. */
export const recordedAt = Math.floor(Date.parse(fixture.provenance.recordedAt) / 1000);
