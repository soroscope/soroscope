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

const load = (file: string): ParityFixture =>
  JSON.parse(readFileSync(resolve(__dirname, '../fixtures', file), 'utf8')) as ParityFixture;

/** The current recording: testnet on protocol 30. */
export const fixture = load('engine-parity.json');

/**
 * Testnet while it still ran protocol 29, recorded 2026-10-31 and kept as it
 * was. It cannot be re-recorded (testnet has moved on) and it is the live
 * evidence for the protocol 29 host. It is testnet's configuration, not
 * mainnet's, though mainnet ran the same protocol; recording mainnet would mean
 * deploying to it.
 */
export const fixture29 = load('engine-parity-protocol-29.json');

export const v1Wasm = Buffer.from(fixture.v1Wasm, 'base64');
export const v2Wasm = Buffer.from(fixture.v2Wasm, 'base64');

/** Seconds since the epoch at the time of recording: the local ledger starts there. */
export const recordedAtOf = (f: ParityFixture): number => Math.floor(Date.parse(f.provenance.recordedAt) / 1000);
export const recordedAt = recordedAtOf(fixture);
