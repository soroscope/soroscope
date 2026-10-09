import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES = resolve(__dirname, '../fixtures');

/** A real RPC exchange captured by `packages/test-utils/scripts/record-rpc.mjs`. */
export interface RpcSample {
  label?: string;
  network?: 'testnet' | 'mainnet';
  url: string;
  request: { method: string; params?: unknown };
  httpStatus?: number;
  headers?: Record<string, string>;
  bodyText?: string;
  capturedAtMs: number;
}

export interface FixtureFile {
  provenance: { tool: string; recordedAt: string };
  samples: RpcSample[];
}

export function loadFixture(name: string): FixtureFile {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8')) as FixtureFile;
}

/** Parse a captured body, which is JSON for every sample except bare HTTP errors. */
export function bodyOf(sample: RpcSample): Record<string, unknown> {
  return JSON.parse(sample.bodyText ?? '{}') as Record<string, unknown>;
}
