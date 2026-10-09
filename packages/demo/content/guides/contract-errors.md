---
title: Contract errors and failed calls
description: How a failed call becomes an error with a name, and how to decode transaction results and error values yourself.
---

## What happens inside a failed call

A Soroban contract that fails emits a diagnostic event shaped `[error, <Error value>]` from the contract that raised it. Its data is `[message, ...details]`. Soroscope reads that event, so for a failed simulation you get:

```ts
import { TransactionSimulator } from '@soroscope/core'

const report = await new TransactionSimulator(router).simulateAndExplain(xdr)
if (!report.ok && report.failure) {
  report.failure.contractId   // 'CC...': the contract that raised it, not necessarily the one you called
  report.failure.error        // { isContractError: true, contractCode: 2, ... }
  report.failure.message      // text the contract attached, if any
  report.failure.errorName    // 'InsufficientFunds'  (from the contract's spec)
  report.failure.errorEnum    // 'Error'
}
```

If the failing contract is a sub-call, `contractId` is the sub-contract, which is what you need to read.

## Naming a code

`Error(Contract, #2)` means the contract returned its error number 2. Its meaning is in the contract's spec:

```ts
import { fetchContractSpec } from '@soroscope/core'

const spec = await fetchContractSpec(router, contractId)
spec.lookupError(2)   // { code: 2, name: 'InsufficientFunds', enumName: 'Error', doc: '...' }
```

`lookupError` returns nothing when no error enum declares the code, or when more than one does; use `lookupErrors` to see all of them.

The built-in Stellar Asset Contract has no spec. Its errors still carry a message in the event data, and the report includes it.

## Host errors

Errors that are not a contract's own (`Error(WasmVm, InvalidAction)` and so on) come back as `isContractError: false` with the error type and code names. A contract that panics produces one of these, with the panic text in the simulation's error string.

## Transaction results

For a submitted transaction, `getTransaction` gives a base64 `TransactionResult`:

```ts
import { decodeTransactionResult, explainTransactionError } from '@soroscope/core'

explainTransactionError(resultXdr)
// 'txFAILED: ... [op 0 · INVOKE_HOST_FUNCTION: ...]'
decodeTransactionResult(resultXdr).operations
```

Operation results for **classic** (non-Soroban) operations are not decoded; the result then has `partial: true`.

## From the shell

```sh
soroscope explain <base64 TransactionResult>
soroscope decode DiagnosticEvent <base64>
soroscope decode ScVal <base64> --plain
```

See the [error reference](/docs/api/error-reference) for every result code.
