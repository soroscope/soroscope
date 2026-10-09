import { decodeAuthEntry } from '../decode/auth';
import { decodeDiagnosticEvent } from '../decode/events';
import { decodeLedgerKey } from '../decode/ledger';
import { decodeScVal, formatScVal } from '../decode/scval';
import { decodeSorobanTransactionData } from '../decode/sorobanData';
import { findFailure } from '../spec/contractError';
import type { RawSimulateResponse, SimulationReport } from './types';

function toBigInt(value: string | undefined, field: string): bigint | null {
  if (value === undefined) return null;
  try {
    return BigInt(value);
  } catch {
    throw new TypeError(`simulateTransaction returned a non-integer ${field}: "${value}"`);
  }
}

/**
 * Decode a raw `simulateTransaction` response. Pure: no network access.
 * @throws {XdrDecodeError} If any embedded XDR is malformed.
 */
export function decodeSimulationResponse(raw: RawSimulateResponse): SimulationReport {
  const events = (raw.events ?? []).map(decodeDiagnosticEvent);
  const first = raw.results?.[0];
  const ok = raw.error === undefined;
  return {
    ok,
    latestLedger: raw.latestLedger,
    returnValue: first === undefined ? null : decodeScVal(first.xdr),
    auth: (first?.auth ?? []).map(decodeAuthEntry),
    events,
    transactionData:
      raw.transactionData === undefined ? null : decodeSorobanTransactionData(raw.transactionData),
    minResourceFee: toBigInt(raw.minResourceFee, 'minResourceFee'),
    restorePreamble:
      raw.restorePreamble === undefined
        ? null
        : {
            minResourceFee: toBigInt(raw.restorePreamble.minResourceFee, 'restorePreamble.minResourceFee') ?? 0n,
            transactionData: decodeSorobanTransactionData(raw.restorePreamble.transactionData),
          },
    stateChanges: (raw.stateChanges ?? []).map((c) => ({
      type: c.type,
      key: decodeLedgerKey(c.key),
      before: c.before ?? null,
      after: c.after ?? null,
    })),
    error: raw.error ?? null,
    failure: ok ? null : findFailure(events),
  };
}

/** One-paragraph, human-readable summary of a simulation. Contract text is quoted, not interpreted. */
export function describeSimulation(report: SimulationReport): string {
  if (report.restorePreamble !== null && !report.ok) {
    return 'Simulation needs archived ledger entries restored first (see restorePreamble).';
  }
  if (report.ok) {
    const parts = [`Simulation succeeded at ledger ${report.latestLedger}.`];
    if (report.returnValue !== null) parts.push(`Returns ${formatScVal(report.returnValue)}.`);
    if (report.transactionData !== null) {
      const r = report.transactionData.resources;
      parts.push(
        `Uses ${r.instructions} instructions, reads ${r.footprint.readOnly.length} and writes ${r.footprint.readWrite.length} ledger entries; resource fee ${report.minResourceFee ?? report.transactionData.resourceFee} stroops.`,
      );
    }
    if (report.auth.length > 0) {
      parts.push(`Needs ${report.auth.length} authorization${report.auth.length === 1 ? '' : 's'}.`);
    }
    return parts.join(' ');
  }
  const f = report.failure;
  if (f === null) return `Simulation failed: ${report.error ?? 'unknown error'}`;
  const who = f.contractId === null ? 'A contract' : `Contract ${f.contractId}`;
  const named = f.errorName === null ? '' : ` (${f.errorEnum === null ? '' : `${f.errorEnum}::`}${f.errorName})`;
  const code = f.error.isContractError ? `Error(Contract, #${f.error.contractCode})` : `${f.error.type}/${String(f.error.code)}`;
  const msg = f.message === null ? '' : ` ${JSON.stringify(f.message)}`;
  return `Simulation failed: ${who} raised ${code}${named}.${msg}`;
}
