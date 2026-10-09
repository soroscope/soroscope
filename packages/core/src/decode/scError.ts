import { base64ToBytes } from '../xdr/base64';
import { XdrReader } from '../xdr/reader';
import { SC_ERROR_TYPES, SC_ERROR_CODES, lookup } from './codes';
import { XdrDecodeError, type DecodedScError } from './types';

/** `SCValType` discriminant for an error value (`SCV_ERROR`). */
const SCV_ERROR = 2;

/** `SCErrorType` discriminant for an application-defined contract error. */
const SCE_CONTRACT = 0;

/**
 * Reads an `ScError` union body at the reader's current position.
 *
 * `union switch (SCErrorType type) { case SCE_CONTRACT: uint32 contractCode; default: SCErrorCode code; }`
 *
 * Exported for reuse by other decoders (e.g. simulation diagnostics).
 */
export function readScError(reader: XdrReader): DecodedScError {
  const typeNum = reader.readEnum();
  const typeInfo = lookup(SC_ERROR_TYPES, typeNum, 'SCErrorType');

  if (typeNum === SCE_CONTRACT) {
    const contractCode = reader.readUint32();
    return {
      category: 'contract',
      type: typeInfo.name,
      code: contractCode,
      isContractError: true,
      contractCode,
      message: `Contract error #${contractCode} (an application-defined error returned by the contract).`,
    };
  }

  const codeNum = reader.readEnum();
  const codeInfo = lookup(SC_ERROR_CODES, codeNum, 'SCErrorCode');
  return {
    category: 'host',
    type: typeInfo.name,
    code: codeInfo.name,
    isContractError: false,
    contractCode: null,
    message: `${typeInfo.message} ${codeInfo.message}`,
  };
}

/**
 * Decodes a base64 (or raw byte) Soroban `ScVal` of type `SCV_ERROR` into a
 * human-readable {@link DecodedScError}.
 *
 * This is the value Soroban returns for contract panics and host failures — for
 * example inside `getTransaction` diagnostic events. The most common case,
 * `SCE_CONTRACT`, surfaces the contract-defined `u32` error code.
 *
 * @param input - Base64 `SCVal` string, or its raw bytes.
 * @throws {XdrDecodeError} If the input is malformed or is not an `SCV_ERROR` value.
 */
export function decodeScError(input: string | Uint8Array): DecodedScError {
  let bytes: Uint8Array;
  try {
    bytes = typeof input === 'string' ? base64ToBytes(input) : input;
  } catch (err) {
    throw new XdrDecodeError(`decodeScError: invalid base64 input (${(err as Error).message})`);
  }

  const reader = new XdrReader(bytes);
  try {
    const valType = reader.readEnum();
    if (valType !== SCV_ERROR) {
      throw new XdrDecodeError(
        `decodeScError: expected an SCV_ERROR value (SCValType ${SCV_ERROR}), got SCValType ${valType}`,
        0,
      );
    }
    return readScError(reader);
  } catch (err) {
    if (err instanceof XdrDecodeError) throw err;
    throw new XdrDecodeError(`decodeScError: ${(err as Error).message}`, reader.position);
  }
}
