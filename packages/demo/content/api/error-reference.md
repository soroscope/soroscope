---
title: Error Reference
description: Every Stellar and Soroban result code Soroscope decodes, with plain-English meanings.
generated: true
---

<!-- Generated from packages/core/src/decode/codes.ts by scripts/gen-error-reference.ts. Do not edit directly; run `pnpm docs:errors`. -->

This page lists every result code the [error decoder](/docs/api/error-decoding) recognises,
generated straight from the SDK's source so it always matches what `explainTransactionError`
and `decodeTransactionResult` actually return.

---

## Transaction result codes

The transaction-level verdict (`TransactionResultCode`). Returned in `code` by
`decodeTransactionResult`.

| Code | Name | Meaning |
| --- | --- | --- |
| `1` | `txFEE_BUMP_INNER_SUCCESS` | The inner transaction of a fee-bump succeeded. |
| `0` | `txSUCCESS` | The transaction succeeded. |
| `-1` | `txFAILED` | One or more operations failed; see the operation results. |
| `-2` | `txTOO_EARLY` | The ledger close time is before the transaction time bounds (minTime). |
| `-3` | `txTOO_LATE` | The ledger close time is after the transaction time bounds (maxTime). |
| `-4` | `txMISSING_OPERATION` | The transaction contained no operations. |
| `-5` | `txBAD_SEQ` | The sequence number does not match the source account. |
| `-6` | `txBAD_AUTH` | Too few valid signatures, or the wrong network was used. |
| `-7` | `txINSUFFICIENT_BALANCE` | The fee would bring the source account below the minimum reserve. |
| `-8` | `txNO_ACCOUNT` | The source account does not exist. |
| `-9` | `txINSUFFICIENT_FEE` | The fee is below the network-required minimum. |
| `-10` | `txBAD_AUTH_EXTRA` | There are unused signatures attached to the transaction. |
| `-11` | `txINTERNAL_ERROR` | An unknown error occurred inside the core node. |
| `-12` | `txNOT_SUPPORTED` | The transaction type is not supported by the network. |
| `-13` | `txFEE_BUMP_INNER_FAILED` | The inner transaction of a fee-bump failed. |
| `-14` | `txBAD_SPONSORSHIP` | The sponsorship is not in the expected state. |
| `-15` | `txBAD_MIN_SEQ_AGE_OR_GAP` | The minSeqAge or minSeqLedgerGap condition was not met. |
| `-16` | `txMALFORMED` | The transaction is malformed. |
| `-17` | `txSOROBAN_INVALID` | The Soroban transaction is invalid (bad resources, footprint, or auth). |

---

## Operation result codes

The outer operation envelope (`OperationResultCode`). `opINNER` means the operation ran and
its inner result carries the detail.

| Code | Name | Meaning |
| --- | --- | --- |
| `0` | `opINNER` | The operation ran; see the inner result. |
| `-1` | `opBAD_AUTH` | Too few valid signatures to authorize the operation. |
| `-2` | `opNO_ACCOUNT` | The operation's source account does not exist. |
| `-3` | `opNOT_SUPPORTED` | The operation is not supported at this time. |
| `-4` | `opTOO_MANY_SUBENTRIES` | The operation would exceed the account subentry limit. |
| `-5` | `opEXCEEDED_WORK_LIMIT` | The operation did too much work (sponsorship traversal limit). |
| `-6` | `opTOO_MANY_SPONSORING` | The account is sponsoring too many entries. |

---

## Soroban operation codes

### `INVOKE_HOST_FUNCTION`

| Code | Name | Meaning |
| --- | --- | --- |
| `0` | `INVOKE_HOST_FUNCTION_SUCCESS` | The host function invocation succeeded. |
| `-1` | `INVOKE_HOST_FUNCTION_MALFORMED` | The host function or its arguments were malformed. |
| `-2` | `INVOKE_HOST_FUNCTION_TRAPPED` | The contract trapped (panicked) during execution. |
| `-3` | `INVOKE_HOST_FUNCTION_RESOURCE_LIMIT_EXCEEDED` | Execution exceeded the declared resource (CPU/memory) budget. |
| `-4` | `INVOKE_HOST_FUNCTION_ENTRY_ARCHIVED` | A required ledger entry is archived and must be restored first. |

### `EXTEND_FOOTPRINT_TTL`

| Code | Name | Meaning |
| --- | --- | --- |
| `0` | `EXTEND_FOOTPRINT_TTL_SUCCESS` | The TTL extension succeeded. |
| `-1` | `EXTEND_FOOTPRINT_TTL_MALFORMED` | The TTL extension operation was malformed. |
| `-2` | `EXTEND_FOOTPRINT_TTL_RESOURCE_LIMIT_EXCEEDED` | The TTL extension exceeded the resource budget. |
| `-3` | `EXTEND_FOOTPRINT_TTL_INSUFFICIENT_REFUNDABLE_FEE` | The refundable fee was too low to cover the TTL extension. |

### `RESTORE_FOOTPRINT`

| Code | Name | Meaning |
| --- | --- | --- |
| `0` | `RESTORE_FOOTPRINT_SUCCESS` | The footprint restoration succeeded. |
| `-1` | `RESTORE_FOOTPRINT_MALFORMED` | The restore operation was malformed. |
| `-2` | `RESTORE_FOOTPRINT_RESOURCE_LIMIT_EXCEEDED` | The restore operation exceeded the resource budget. |
| `-3` | `RESTORE_FOOTPRINT_INSUFFICIENT_REFUNDABLE_FEE` | The refundable fee was too low to cover the restore. |

---

## Contract error (`ScError`)

`decodeScError` surfaces these. The **type** is the domain the error came from; the **code**
is the specific failure within that domain (for non-contract errors).

### Error types (`SCErrorType`)

| Code | Name | Meaning |
| --- | --- | --- |
| `9` | `Auth` | An authorization error. |
| `8` | `Value` | An error converting or handling an ScVal value. |
| `7` | `Budget` | The CPU/memory budget was exceeded. |
| `6` | `Events` | An error emitting or handling a contract event. |
| `5` | `Crypto` | An error in a cryptographic operation. |
| `4` | `Object` | An error handling a host object. |
| `3` | `Storage` | An error accessing contract storage / ledger entries. |
| `2` | `Context` | An error in the host execution context. |
| `1` | `WasmVm` | An error from the WebAssembly virtual machine. |
| `0` | `Contract` | An error raised by the contract itself (application-defined). |

### Error codes (`SCErrorCode`)

| Code | Name | Meaning |
| --- | --- | --- |
| `9` | `UnexpectedSize` | A value had an unexpected size. |
| `8` | `UnexpectedType` | A value had an unexpected type. |
| `7` | `InternalError` | An internal error occurred in the host. |
| `6` | `InvalidAction` | The attempted action was not allowed. |
| `5` | `ExceededLimit` | A limit was exceeded. |
| `4` | `ExistingValue` | A value already existed where none was expected. |
| `3` | `MissingValue` | A required value was missing. |
| `2` | `InvalidInput` | The input was invalid. |
| `1` | `IndexBounds` | An index was out of bounds. |
| `0` | `ArithDomain` | An arithmetic operation went out of range (overflow/underflow). |
