---
title: explainTransactionError
description: Function explainTransactionError — @soroscope/core API reference.
generated: true
---

> **explainTransactionError**(`input`): `string`

Defined in: [packages/core/src/decode/explain.ts:25](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/explain.ts#L25)

Renders a one-line, human-readable explanation of a failed Soroban
transaction from whatever the RPC handed back.

Accepts either a base64 `TransactionResult` string directly, or the RPC
response object (`errorResultXdr` preferred, then `resultXdr`, then `status`).

## Parameters

### input

`string` \| [`TransactionErrorInput`](/docs/reference/transactionerrorinput)

## Returns

`string`

## Example

```ts
const res = await client.call('sendTransaction', [signedXdr]);
if (res.status === 'ERROR') console.error(explainTransactionError(res));
```
