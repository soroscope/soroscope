import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface XdrItem {
  type: string;
  b64: string;
  source: string;
  /** What `stellar xdr decode --output json` printed for this blob. */
  oracle: unknown;
  oracleError: string | null;
}

export interface SimulationSample {
  name: string;
  function: string;
  request: { transaction: string };
  response: Record<string, unknown> & { error?: string; events?: string[] };
}

export interface ContractSample {
  contractId: string;
  wasmHash: string;
  /** Base64 `LedgerKey` the stellar CLI produced for this contract's instance entry. */
  instanceKey: string;
  instanceEntryXdr: string;
  /** Base64 `LedgerKey` the stellar CLI produced for this contract's code entry. */
  codeKey: string;
  codeEntryXdr: string;
  wasmBase64: string;
  /** `stellar contract info interface --output json`. */
  oracleSpec: unknown[] | null;
  /** `stellar contract info meta --output json`. */
  oracleMeta: { sc_meta_v0: { key: string; val: string } }[] | null;
}

export interface SorobanFixture {
  provenance: { tool: string; recordedAt: string; stellarCli: string; nativeAssetContract: string; latestLedger: number };
  simulations: SimulationSample[];
  contracts: ContractSample[];
  items: XdrItem[];
}

export const soroban: SorobanFixture = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/soroban-xdr.json'), 'utf8'),
) as SorobanFixture;

export const itemsOf = (type: string): XdrItem[] => soroban.items.filter((i) => i.type === type);
