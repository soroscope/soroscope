import { decodeTransactionResult } from './transactionResult';
import type { DecodedTransactionResult } from './types';

/** Shape of the failure fields Soroban RPC returns from send/get transaction. */
export interface TransactionErrorInput {
  /** Base64 `TransactionResult` from a failed `sendTransaction`. */
  errorResultXdr?: string;
  /** Base64 `TransactionResult` from `getTransaction`. */
  resultXdr?: string;
  /** RPC status string (e.g. `'ERROR'`, `'FAILED'`), used as a fallback. */
  status?: string;
}

/**
 * Renders a one-line, human-readable explanation of a failed Soroban
 * transaction from whatever the RPC handed back.
 *
 * Accepts either a base64 `TransactionResult` string directly, or the RPC
 * response object (`errorResultXdr` preferred, then `resultXdr`, then `status`).
 *
 * @example
 * const res = await client.call('sendTransaction', [signedXdr]);
 * if (res.status === 'ERROR') console.error(explainTransactionError(res));
 */
export function explainTransactionError(input: string | TransactionErrorInput): string {
  if (typeof input === 'string') {
    return formatTransactionResult(decodeTransactionResult(input));
  }

  const xdr = input.errorResultXdr ?? input.resultXdr;
  if (xdr !== undefined) {
    return formatTransactionResult(decodeTransactionResult(xdr));
  }

  if (input.status !== undefined) {
    return `Transaction reported status '${input.status}', but no result XDR was provided to decode.`;
  }

  return 'No transaction error information was provided.';
}

/** Composes a decoded transaction result into a single readable sentence. */
export function formatTransactionResult(decoded: DecodedTransactionResult): string {
  let text = `${decoded.code}: ${decoded.message}`;

  const failed = decoded.operations.filter((op) => !op.successful);
  for (let i = 0; i < decoded.operations.length; i++) {
    const op = decoded.operations[i];
    if (op !== undefined && !op.successful) {
      const label = op.operationType ?? op.code;
      text += ` [op ${i} · ${label}: ${op.message}]`;
    }
  }

  if (failed.length === 0 && decoded.operations.length > 0 && !decoded.successful) {
    text += ' (no operation reported a failure)';
  }

  if (decoded.partial) {
    text += ' (some operation results could not be fully decoded)';
  }

  return text;
}
