import { canonicalLedgerKey, formatScVal } from '@soroscope/core';
import type { SimulationReport } from '@soroscope/core';

/** Numeric resource metrics, in the units the network meters them. */
export interface NumericMetrics {
  /** CPU instructions the transaction declares it needs. */
  instructions: string;
  diskReadBytes: string;
  writeBytes: string;
  /** Resource fee in stroops. */
  resourceFee: string;
  readOnlyKeys: number;
  readWriteKeys: number;
  authEntries: number;
  events: number;
}

/** One invocation's measured behaviour. */
export interface Measurement {
  /** Whether the simulation succeeded. */
  ok: boolean;
  /** Contract error name when it failed with a named contract error. */
  errorName: string | null;
  /** Null for a failed simulation (a failure has no resource profile). */
  metrics: NumericMetrics | null;
  footprint: { readOnly: string[]; readWrite: string[] } | null;
  returnValue: string | null;
  /** Ledger the measurement was taken at. */
  ledger: number;
}

/** Replace every occurrence of a known per-run address with its stable alias. */
function aliasText(text: string, aliases: Readonly<Record<string, string>>): string {
  return Object.entries(aliases).reduce((acc, [address, alias]) => acc.split(address).join(alias), text);
}

/**
 * Reduce a decoded simulation to the metrics the checks compare. Contract ids
 * and account addresses in `aliases` are replaced by their `$alias`, because the id
 * of a freshly deployed contract, and the throwaway deployer, differ on every run
 * (and appear inside ledger keys such as a balance entry).
 */
export function measure(report: SimulationReport, aliases: Readonly<Record<string, string>> = {}): Measurement {
  const data = report.transactionData;
  if (!report.ok || data === null) {
    return {
      ok: false,
      errorName: report.failure?.errorName ?? null,
      metrics: null,
      footprint: null,
      returnValue: null,
      ledger: report.latestLedger,
    };
  }
  const keys = (list: typeof data.resources.footprint.readOnly): string[] =>
    list.map((k) => aliasText(canonicalLedgerKey(k, aliases), aliases)).sort();
  const readOnly = keys(data.resources.footprint.readOnly);
  const readWrite = keys(data.resources.footprint.readWrite);
  return {
    ok: true,
    errorName: null,
    metrics: {
      instructions: String(data.resources.instructions),
      diskReadBytes: String(data.resources.diskReadBytes),
      writeBytes: String(data.resources.writeBytes),
      resourceFee: String(report.minResourceFee ?? data.resourceFee),
      readOnlyKeys: readOnly.length,
      readWriteKeys: readWrite.length,
      authEntries: report.auth.length,
      events: report.events.length,
    },
    footprint: { readOnly, readWrite },
    returnValue: report.returnValue === null ? null : aliasText(formatScVal(report.returnValue), aliases),
    ledger: report.latestLedger,
  };
}
