/**
 * Curated Stellar / Soroban result-code catalogs with plain-English messages.
 *
 * Values mirror the canonical XDR definitions in `Stellar-transaction.x` and
 * `Stellar-contract.x`. Keeping these as hand-maintained constants (rather than
 * generating them from `.x` files) is what lets the decoder stay
 * zero-dependency.
 */

/** A code's canonical name plus a human-readable explanation. */
export interface CodeInfo {
  name: string;
  message: string;
}

/** Operation type numbers we fully model (the three Soroban operations). */
export const OperationType = {
  INVOKE_HOST_FUNCTION: 24,
  EXTEND_FOOTPRINT_TTL: 25,
  RESTORE_FOOTPRINT: 26,
} as const;

/** `TransactionResultCode` → explanation. */
export const TX_RESULT_CODES: Readonly<Record<number, CodeInfo>> = {
  1: {
    name: 'txFEE_BUMP_INNER_SUCCESS',
    message: 'The inner transaction of a fee-bump succeeded.',
  },
  0: { name: 'txSUCCESS', message: 'The transaction succeeded.' },
  [-1]: { name: 'txFAILED', message: 'One or more operations failed; see the operation results.' },
  [-2]: {
    name: 'txTOO_EARLY',
    message: 'The ledger close time is before the transaction time bounds (minTime).',
  },
  [-3]: {
    name: 'txTOO_LATE',
    message: 'The ledger close time is after the transaction time bounds (maxTime).',
  },
  [-4]: { name: 'txMISSING_OPERATION', message: 'The transaction contained no operations.' },
  [-5]: { name: 'txBAD_SEQ', message: 'The sequence number does not match the source account.' },
  [-6]: { name: 'txBAD_AUTH', message: 'Too few valid signatures, or the wrong network was used.' },
  [-7]: {
    name: 'txINSUFFICIENT_BALANCE',
    message: 'The fee would bring the source account below the minimum reserve.',
  },
  [-8]: { name: 'txNO_ACCOUNT', message: 'The source account does not exist.' },
  [-9]: { name: 'txINSUFFICIENT_FEE', message: 'The fee is below the network-required minimum.' },
  [-10]: {
    name: 'txBAD_AUTH_EXTRA',
    message: 'There are unused signatures attached to the transaction.',
  },
  [-11]: { name: 'txINTERNAL_ERROR', message: 'An unknown error occurred inside the core node.' },
  [-12]: {
    name: 'txNOT_SUPPORTED',
    message: 'The transaction type is not supported by the network.',
  },
  [-13]: {
    name: 'txFEE_BUMP_INNER_FAILED',
    message: 'The inner transaction of a fee-bump failed.',
  },
  [-14]: { name: 'txBAD_SPONSORSHIP', message: 'The sponsorship is not in the expected state.' },
  [-15]: {
    name: 'txBAD_MIN_SEQ_AGE_OR_GAP',
    message: 'The minSeqAge or minSeqLedgerGap condition was not met.',
  },
  [-16]: { name: 'txMALFORMED', message: 'The transaction is malformed.' },
  [-17]: {
    name: 'txSOROBAN_INVALID',
    message: 'The Soroban transaction is invalid (bad resources, footprint, or auth).',
  },
};

/** `OperationResultCode` → explanation (the outer operation envelope). */
export const OP_RESULT_CODES: Readonly<Record<number, CodeInfo>> = {
  0: { name: 'opINNER', message: 'The operation ran; see the inner result.' },
  [-1]: { name: 'opBAD_AUTH', message: 'Too few valid signatures to authorize the operation.' },
  [-2]: { name: 'opNO_ACCOUNT', message: "The operation's source account does not exist." },
  [-3]: { name: 'opNOT_SUPPORTED', message: 'The operation is not supported at this time.' },
  [-4]: {
    name: 'opTOO_MANY_SUBENTRIES',
    message: 'The operation would exceed the account subentry limit.',
  },
  [-5]: {
    name: 'opEXCEEDED_WORK_LIMIT',
    message: 'The operation did too much work (sponsorship traversal limit).',
  },
  [-6]: { name: 'opTOO_MANY_SPONSORING', message: 'The account is sponsoring too many entries.' },
};

/** `OperationType` number → canonical name (used to label `opINNER` results). */
export const OPERATION_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: 'CREATE_ACCOUNT',
  1: 'PAYMENT',
  2: 'PATH_PAYMENT_STRICT_RECEIVE',
  3: 'MANAGE_SELL_OFFER',
  4: 'CREATE_PASSIVE_SELL_OFFER',
  5: 'SET_OPTIONS',
  6: 'CHANGE_TRUST',
  7: 'ALLOW_TRUST',
  8: 'ACCOUNT_MERGE',
  9: 'INFLATION',
  10: 'MANAGE_DATA',
  11: 'BUMP_SEQUENCE',
  12: 'MANAGE_BUY_OFFER',
  13: 'PATH_PAYMENT_STRICT_SEND',
  14: 'CREATE_CLAIMABLE_BALANCE',
  15: 'CLAIM_CLAIMABLE_BALANCE',
  16: 'BEGIN_SPONSORING_FUTURE_RESERVES',
  17: 'END_SPONSORING_FUTURE_RESERVES',
  18: 'REVOKE_SPONSORSHIP',
  19: 'CLAWBACK',
  20: 'CLAWBACK_CLAIMABLE_BALANCE',
  21: 'SET_TRUST_LINE_FLAGS',
  22: 'LIQUIDITY_POOL_DEPOSIT',
  23: 'LIQUIDITY_POOL_WITHDRAW',
  24: 'INVOKE_HOST_FUNCTION',
  25: 'EXTEND_FOOTPRINT_TTL',
  26: 'RESTORE_FOOTPRINT',
};

/** `InvokeHostFunctionResultCode` → explanation. */
export const INVOKE_HOST_FUNCTION_CODES: Readonly<Record<number, CodeInfo>> = {
  0: { name: 'INVOKE_HOST_FUNCTION_SUCCESS', message: 'The host function invocation succeeded.' },
  [-1]: {
    name: 'INVOKE_HOST_FUNCTION_MALFORMED',
    message: 'The host function or its arguments were malformed.',
  },
  [-2]: {
    name: 'INVOKE_HOST_FUNCTION_TRAPPED',
    message: 'The contract trapped (panicked) during execution.',
  },
  [-3]: {
    name: 'INVOKE_HOST_FUNCTION_RESOURCE_LIMIT_EXCEEDED',
    message: 'Execution exceeded the declared resource (CPU/memory) budget.',
  },
  [-4]: {
    name: 'INVOKE_HOST_FUNCTION_ENTRY_ARCHIVED',
    message: 'A required ledger entry is archived and must be restored first.',
  },
};

/** `ExtendFootprintTTLResultCode` → explanation. */
export const EXTEND_FOOTPRINT_TTL_CODES: Readonly<Record<number, CodeInfo>> = {
  0: { name: 'EXTEND_FOOTPRINT_TTL_SUCCESS', message: 'The TTL extension succeeded.' },
  [-1]: {
    name: 'EXTEND_FOOTPRINT_TTL_MALFORMED',
    message: 'The TTL extension operation was malformed.',
  },
  [-2]: {
    name: 'EXTEND_FOOTPRINT_TTL_RESOURCE_LIMIT_EXCEEDED',
    message: 'The TTL extension exceeded the resource budget.',
  },
  [-3]: {
    name: 'EXTEND_FOOTPRINT_TTL_INSUFFICIENT_REFUNDABLE_FEE',
    message: 'The refundable fee was too low to cover the TTL extension.',
  },
};

/** `RestoreFootprintResultCode` → explanation. */
export const RESTORE_FOOTPRINT_CODES: Readonly<Record<number, CodeInfo>> = {
  0: { name: 'RESTORE_FOOTPRINT_SUCCESS', message: 'The footprint restoration succeeded.' },
  [-1]: { name: 'RESTORE_FOOTPRINT_MALFORMED', message: 'The restore operation was malformed.' },
  [-2]: {
    name: 'RESTORE_FOOTPRINT_RESOURCE_LIMIT_EXCEEDED',
    message: 'The restore operation exceeded the resource budget.',
  },
  [-3]: {
    name: 'RESTORE_FOOTPRINT_INSUFFICIENT_REFUNDABLE_FEE',
    message: 'The refundable fee was too low to cover the restore.',
  },
};

/**
 * Per-operation result-code tables for the operation types this decoder models
 * fully, keyed by `OperationType` number. These three Soroban operations all
 * have `union switch(code) { case SUCCESS: ...; default: void; }` results, so
 * reading the code is enough to explain a failure.
 */
export const SOROBAN_OP_RESULT_CODES: Readonly<Record<number, Readonly<Record<number, CodeInfo>>>> =
  {
    [OperationType.INVOKE_HOST_FUNCTION]: INVOKE_HOST_FUNCTION_CODES,
    [OperationType.EXTEND_FOOTPRINT_TTL]: EXTEND_FOOTPRINT_TTL_CODES,
    [OperationType.RESTORE_FOOTPRINT]: RESTORE_FOOTPRINT_CODES,
  };

/** `SCErrorType` → name + explanation (the domain a Soroban error came from). */
export const SC_ERROR_TYPES: Readonly<Record<number, CodeInfo>> = {
  0: { name: 'Contract', message: 'An error raised by the contract itself (application-defined).' },
  1: { name: 'WasmVm', message: 'An error from the WebAssembly virtual machine.' },
  2: { name: 'Context', message: 'An error in the host execution context.' },
  3: { name: 'Storage', message: 'An error accessing contract storage / ledger entries.' },
  4: { name: 'Object', message: 'An error handling a host object.' },
  5: { name: 'Crypto', message: 'An error in a cryptographic operation.' },
  6: { name: 'Events', message: 'An error emitting or handling a contract event.' },
  7: { name: 'Budget', message: 'The CPU/memory budget was exceeded.' },
  8: { name: 'Value', message: 'An error converting or handling an ScVal value.' },
  9: { name: 'Auth', message: 'An authorization error.' },
};

/** `SCErrorCode` → name + explanation (the specific failure within a domain). */
export const SC_ERROR_CODES: Readonly<Record<number, CodeInfo>> = {
  0: {
    name: 'ArithDomain',
    message: 'An arithmetic operation went out of range (overflow/underflow).',
  },
  1: { name: 'IndexBounds', message: 'An index was out of bounds.' },
  2: { name: 'InvalidInput', message: 'The input was invalid.' },
  3: { name: 'MissingValue', message: 'A required value was missing.' },
  4: { name: 'ExistingValue', message: 'A value already existed where none was expected.' },
  5: { name: 'ExceededLimit', message: 'A limit was exceeded.' },
  6: { name: 'InvalidAction', message: 'The attempted action was not allowed.' },
  7: { name: 'InternalError', message: 'An internal error occurred in the host.' },
  8: { name: 'UnexpectedType', message: 'A value had an unexpected type.' },
  9: { name: 'UnexpectedSize', message: 'A value had an unexpected size.' },
};

/** Looks up a code in a table, falling back to a generic label for unknown values. */
export function lookup(
  table: Readonly<Record<number, CodeInfo>>,
  code: number,
  kind: string,
): CodeInfo {
  return table[code] ?? { name: `${kind}(${code})`, message: `Unknown ${kind} code ${code}.` };
}
