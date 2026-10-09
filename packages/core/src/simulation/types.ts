import type { AuthEntry } from '../decode/auth';
import type { DiagnosticEvent } from '../decode/events';
import type { LedgerKey } from '../decode/ledger';
import type { ScVal } from '../decode/scval';
import type { SorobanTransactionData } from '../decode/sorobanData';
import type { ContractFailure } from '../spec/contractError';

/** Parameters accepted by the `simulateTransaction` JSON-RPC method. */
export interface SimulateTransactionParams {
  /** Base64-encoded `TransactionEnvelope` XDR to simulate. */
  transaction: string;
  resourceConfig?: { instructionLeeway: number };
}

/** A ledger entry change the simulation predicts. */
export interface RawStateChange {
  type: 'created' | 'updated' | 'deleted';
  /** Base64 `LedgerKey`. */
  key: string;
  /** Base64 `LedgerEntry` before the call (absent for `created`). */
  before?: string | null;
  /** Base64 `LedgerEntry` after the call (absent for `deleted`). */
  after?: string | null;
}

/**
 * The raw `simulateTransaction` response. Captured from live Stellar RPC: the
 * response carries no CPU/memory `cost` object; resource use is in
 * `transactionData`.
 */
export interface RawSimulateResponse {
  latestLedger: number;
  /** Present only when the simulation failed. */
  error?: string;
  /** Base64 `SorobanTransactionData` (footprint and resources). */
  transactionData?: string;
  /** Minimum resource fee in stroops, as a decimal string. */
  minResourceFee?: string;
  /** Base64 `DiagnosticEvent` entries emitted during simulation. */
  events?: string[];
  /** Invocation results: at most one for a Soroban operation. */
  results?: { xdr: string; auth?: string[] }[];
  /** Present when archived ledger entries must be restored before submitting. */
  restorePreamble?: { minResourceFee: string; transactionData: string };
  stateChanges?: RawStateChange[];
}

export interface StateChange {
  type: 'created' | 'updated' | 'deleted';
  key: LedgerKey;
  /** Base64 `LedgerEntry` before the call. */
  before: string | null;
  /** Base64 `LedgerEntry` after the call. */
  after: string | null;
}

/** A simulation, fully decoded. Nothing is left as base64 except raw ledger entry bodies. */
export interface SimulationReport {
  /** True when the simulation succeeded. */
  ok: boolean;
  latestLedger: number;
  /** The call's return value; null if it failed or returned nothing. */
  returnValue: ScVal | null;
  /** Authorizations the transaction will need, one per address that must sign. */
  auth: AuthEntry[];
  events: DiagnosticEvent[];
  /** Footprint and resource budget the transaction should declare. */
  transactionData: SorobanTransactionData | null;
  /** Minimum resource fee in stroops. */
  minResourceFee: bigint | null;
  /** Archived entries that must be restored before the transaction can succeed. */
  restorePreamble: { minResourceFee: bigint; transactionData: SorobanTransactionData } | null;
  stateChanges: StateChange[];
  /** The raw error text when the simulation failed. */
  error: string | null;
  /** The contract error behind a failure, when the diagnostic events identify one. */
  failure: ContractFailure | null;
}

export interface SimulateOptions {
  /** Extra CPU instructions to budget beyond the measured use, as the RPC's `instructionLeeway`. */
  instructionLeeway?: number;
}

/** Thrown by `estimateFee` when the simulation fails. Carries the full report. */
export class SimulationError extends Error {
  readonly report: SimulationReport;

  constructor(message: string, report: SimulationReport) {
    super(message);
    this.name = 'SimulationError';
    this.report = report;
  }
}
