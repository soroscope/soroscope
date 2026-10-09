/**
 * Public types and the error class for the XDR decoding layer.
 *
 * These are intentionally plain data shapes (no XDR types leak out) so the SDK
 * stays dependency-free and the decoded output is easy to log, serialize, or
 * surface to end users.
 */

/** Broad classification of a decoded failure, useful for routing/handling. */
export type XdrErrorCategory = 'transaction' | 'operation' | 'contract' | 'host';

/** A single operation's decoded result within a transaction. */
export interface DecodedOperationResult {
  /** `OperationResultCode` name, e.g. `'opINNER'`, `'opNO_ACCOUNT'`. */
  code: string;
  /** `OperationType` name when `code === 'opINNER'`, otherwise `null`. */
  operationType: string | null;
  /**
   * Inner per-operation result code name when the operation type is modeled
   * (the Soroban operations), otherwise `null`.
   */
  innerCode: string | null;
  /** Whether this operation succeeded. */
  successful: boolean;
  /** Human-readable explanation of this operation's result. */
  message: string;
}

/** Decoded form of a base64 `TransactionResult` XDR blob. */
export interface DecodedTransactionResult {
  /** Fee charged for the transaction, in stroops. */
  feeCharged: bigint;
  /** `TransactionResultCode` name, e.g. `'txFAILED'`, `'txBAD_SEQ'`. */
  code: string;
  /** Whether the transaction as a whole succeeded. */
  successful: boolean;
  /** Human-readable explanation of the transaction-level result. */
  message: string;
  /** Per-operation results (empty for tx-level failures that carry no op results). */
  operations: DecodedOperationResult[];
  /**
   * `true` when decoding stopped early because an operation type is not modeled
   * by this zero-dependency decoder. The transaction-level result is still
   * accurate; `operations` may be incomplete.
   */
  partial: boolean;
  /** The original base64 input, retained for round-trip/debugging. */
  raw: string;
}

/** Decoded form of a Soroban `ScError` (an `SCV_ERROR` ScVal). */
export interface DecodedScError {
  /** Broad category — `'contract'` for app-defined errors, otherwise `'host'`. */
  category: XdrErrorCategory;
  /** `SCErrorType` name, e.g. `'Contract'`, `'WasmVm'`, `'Budget'`. */
  type: string;
  /**
   * For a contract error, the contract-defined `u32` code (`contractCode`);
   * for any other type, the `SCErrorCode` name.
   */
  code: number | string;
  /** Whether this is an application-defined contract error (`SCE_CONTRACT`). */
  isContractError: boolean;
  /** The contract-defined error code when `isContractError`, otherwise `null`. */
  contractCode: number | null;
  /** Human-readable explanation. */
  message: string;
}

/**
 * Thrown when an XDR blob cannot be decoded — malformed base64, truncated
 * bytes, or an unexpected/unknown discriminant where a known one is required.
 */
export class XdrDecodeError extends Error {
  /** The byte offset at which decoding failed, when known. */
  readonly offset: number | null;

  constructor(message: string, offset: number | null = null) {
    super(message);
    this.name = 'XdrDecodeError';
    this.offset = offset;
  }
}
