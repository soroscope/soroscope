import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Measurement } from './metrics';

/** What a baseline entry remembers about one invocation. */
export interface BaselineEntry extends Measurement {
  function: string;
  /** SHA-256 of the WASM that produced it, when the contract was built from local code. */
  wasmSha256?: string;
}

/** The conditions a baseline was recorded under. Fee and cost comparisons are only meaningful within one. */
export interface BaselineEnvironment {
  network: string;
  protocolVersion: number | null;
}

export interface Baseline {
  version: 1;
  generatedAt: string;
  tool: string;
  environment: BaselineEnvironment;
  entries: Record<string, BaselineEntry>;
}

/** Stable JSON: object keys sorted at every level, so a baseline diff shows only real changes. */
export function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (typeof v === 'object' && v !== null) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, val]) => [k, sort(val)]),
      );
    }
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** Read a baseline, or null if the file does not exist yet. */
export function readBaseline(path: string): Baseline | null {
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Baseline;
  if (parsed.version !== 1 || typeof parsed.entries !== 'object') {
    throw new Error(`${path} is not a Soroscope baseline (expected version 1)`);
  }
  return parsed;
}

export function writeBaseline(path: string, baseline: Baseline): void {
  writeFileSync(path, stableStringify(baseline));
}
