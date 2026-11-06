import { canonicalLedgerKey } from '../decode/ledger';
import { scValToJs } from '../decode/scval';
import type { SimulationReport } from './types';

/** One field two simulations disagree on. */
export interface SimulationDifference {
  /**
   * `outcome`, `error`, `returnValue`, `auth`, `minResourceFee`, `instructions`,
   * `diskReadBytes`, `writeBytes`, `footprint.readOnly` or `footprint.readWrite`.
   */
  field: string;
  /** The value in the first report, as text. */
  a: string;
  /** The value in the second report, as text. */
  b: string;
}

const text = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? x.toString() : x)) ?? 'undefined';

/**
 * Every field of a simulation that two simulations of the same call can
 * disagree on, as comparable text: `outcome`, then either `error` (a failed
 * call) or `returnValue`, `auth`, `minResourceFee`, `instructions`,
 * `diskReadBytes`, `writeBytes`, `footprint.readOnly` and `footprint.readWrite`
 * (a successful one). `latestLedger` and the diagnostic events are left out:
 * the ledger a provider answers at differs without meaning anything is wrong,
 * and events are diagnostics, not results.
 */
export function simulationFields(report: SimulationReport): Record<string, string> {
  const out: Record<string, string> = { outcome: text(report.ok) };
  if (!report.ok) {
    out.error = text(report.failure?.error ?? report.error);
    return out;
  }
  out.returnValue = text(report.returnValue === null ? null : scValToJs(report.returnValue));
  out.auth = text(report.auth.length);
  out.minResourceFee = text(report.minResourceFee);
  const r = report.transactionData?.resources;
  out.instructions = text(r?.instructions);
  if (r === undefined) return out;
  out.diskReadBytes = text(r.diskReadBytes);
  out.writeBytes = text(r.writeBytes);
  const keys = (ks: Parameters<typeof canonicalLedgerKey>[0][]): string[] =>
    ks.map((k) => canonicalLedgerKey(k)).sort();
  out['footprint.readOnly'] = text(keys(r.footprint.readOnly));
  out['footprint.readWrite'] = text(keys(r.footprint.readWrite));
  return out;
}

/**
 * Compare two decoded simulations of the same call and name every field they
 * disagree on (see {@link simulationFields}). If one succeeded and the other
 * failed, only the outcome is reported: the rest is not comparable.
 *
 * Two simulations that agree return an empty list. Used to check a local
 * engine against the network and to compare providers with each other.
 */
export function compareSimulations(
  a: SimulationReport,
  b: SimulationReport,
): SimulationDifference[] {
  const [fa, fb] = [simulationFields(a), simulationFields(b)];
  if (fa.outcome !== fb.outcome) return [{ field: 'outcome', a: fa.outcome!, b: fb.outcome! }];
  const out: SimulationDifference[] = [];
  for (const field of Object.keys(fa)) {
    if (fa[field] !== fb[field]) out.push({ field, a: fa[field]!, b: fb[field] ?? 'undefined' });
  }
  return out;
}
