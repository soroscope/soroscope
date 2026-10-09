import { base64ToBytes } from '../xdr/base64';
import { XdrReader } from '../xdr/reader';
import {
  TX_RESULT_CODES,
  OP_RESULT_CODES,
  OPERATION_TYPE_NAMES,
  SOROBAN_OP_RESULT_CODES,
  OperationType,
  lookup,
} from './codes';
import {
  XdrDecodeError,
  type DecodedOperationResult,
  type DecodedTransactionResult,
} from './types';

/** `TransactionResultCode` values whose body is a `results<>` array. */
const TX_SUCCESS = 0;
const TX_FAILED = -1;

/** `TransactionResultCode` values whose body is an `InnerTransactionResultPair`. */
const TX_FEE_BUMP_INNER_SUCCESS = 1;
const TX_FEE_BUMP_INNER_FAILED = -13;

/** `OperationResultCode.opINNER`. */
const OP_INNER = 0;

/** Size of a `Hash` (`InvokeHostFunctionSuccess`), in bytes. */
const HASH_BYTES = 32;

/**
 * Decodes a base64 `TransactionResult` XDR blob — the value Soroban RPC returns
 * as `errorResultXdr` (from `sendTransaction`) or `resultXdr` (from
 * `getTransaction`) — into a structured, human-readable result.
 *
 * Transaction-level codes are always decoded. Operation-level results are
 * decoded for void-bodied codes and for the three Soroban operations; if a
 * classic operation with a non-trivial result union is encountered, decoding
 * stops and `partial` is set (the transaction-level verdict is still accurate).
 *
 * @throws {XdrDecodeError} If the input is malformed or truncated.
 */
export function decodeTransactionResult(xdrBase64: string): DecodedTransactionResult {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(xdrBase64);
  } catch (err) {
    throw new XdrDecodeError(
      `decodeTransactionResult: invalid base64 input (${(err as Error).message})`,
    );
  }

  const reader = new XdrReader(bytes);
  try {
    const feeCharged = reader.readInt64();
    const codeNum = reader.readEnum();
    const codeInfo = lookup(TX_RESULT_CODES, codeNum, 'TransactionResultCode');
    const successful = codeNum === TX_SUCCESS || codeNum === TX_FEE_BUMP_INNER_SUCCESS;

    let operations: DecodedOperationResult[] = [];
    let partial = false;

    if (codeNum === TX_SUCCESS || codeNum === TX_FAILED) {
      const result = readOperationResults(reader);
      operations = result.operations;
      partial = result.partial;
    } else if (codeNum === TX_FEE_BUMP_INNER_SUCCESS || codeNum === TX_FEE_BUMP_INNER_FAILED) {
      // The body is an InnerTransactionResultPair, which this decoder does not
      // model. The fee-bump verdict above is still accurate.
      partial = true;
    }

    return {
      feeCharged,
      code: codeInfo.name,
      successful,
      message: codeInfo.message,
      operations,
      partial,
      raw: xdrBase64,
    };
  } catch (err) {
    if (err instanceof XdrDecodeError) throw err;
    throw new XdrDecodeError(`decodeTransactionResult: ${(err as Error).message}`, reader.position);
  }
}

/** Reads a length-prefixed `OperationResult results<>` array. */
function readOperationResults(reader: XdrReader): {
  operations: DecodedOperationResult[];
  partial: boolean;
} {
  const count = reader.readLength();
  const operations: DecodedOperationResult[] = [];

  for (let i = 0; i < count; i++) {
    const opCodeNum = reader.readEnum();

    if (opCodeNum !== OP_INNER) {
      // Non-inner codes (opBAD_AUTH, opNO_ACCOUNT, …) have a void body.
      const info = lookup(OP_RESULT_CODES, opCodeNum, 'OperationResultCode');
      operations.push({
        code: info.name,
        operationType: null,
        innerCode: null,
        successful: false,
        message: info.message,
      });
      continue;
    }

    const opType = reader.readEnum();
    const opTypeName = OPERATION_TYPE_NAMES[opType] ?? `OperationType(${opType})`;
    const innerTable = SOROBAN_OP_RESULT_CODES[opType];

    if (innerTable === undefined) {
      // A classic operation result union we don't model: we can't reliably
      // advance past it, so report what we know and stop.
      operations.push({
        code: 'opINNER',
        operationType: opTypeName,
        innerCode: null,
        successful: false,
        message: `Operation '${opTypeName}' result is not decoded by this zero-dependency decoder.`,
      });
      return { operations, partial: true };
    }

    const innerCodeNum = reader.readEnum();
    const innerInfo = lookup(innerTable, innerCodeNum, opTypeName);
    const opSuccessful = innerCodeNum === 0;

    // INVOKE_HOST_FUNCTION success carries a 32-byte Hash; consume it so a
    // following operation (if any) reads from the right offset.
    if (opType === OperationType.INVOKE_HOST_FUNCTION && opSuccessful) {
      reader.readFixedOpaque(HASH_BYTES);
    }

    operations.push({
      code: 'opINNER',
      operationType: opTypeName,
      innerCode: innerInfo.name,
      successful: opSuccessful,
      message: innerInfo.message,
    });
  }

  return { operations, partial: false };
}
