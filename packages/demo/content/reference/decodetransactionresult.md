---
title: decodeTransactionResult
description: Function decodeTransactionResult — @soroscope/core API reference.
generated: true
---

> **decodeTransactionResult**(`xdrBase64`): [`DecodedTransactionResult`](/docs/reference/decodedtransactionresult)

Defined in: [packages/core/src/decode/transactionResult.ts:43](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/transactionResult.ts#L43)

Decodes a base64 `TransactionResult` XDR blob — the value Soroban RPC returns
as `errorResultXdr` (from `sendTransaction`) or `resultXdr` (from
`getTransaction`) — into a structured, human-readable result.

Transaction-level codes are always decoded. Operation-level results are
decoded for void-bodied codes and for the three Soroban operations; if a
classic operation with a non-trivial result union is encountered, decoding
stops and `partial` is set (the transaction-level verdict is still accurate).

## Parameters

### xdrBase64

`string`

## Returns

[`DecodedTransactionResult`](/docs/reference/decodedtransactionresult)

## Throws

If the input is malformed or truncated.
