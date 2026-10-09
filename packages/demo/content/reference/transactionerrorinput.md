---
title: TransactionErrorInput
description: Interface TransactionErrorInput — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/decode/explain.ts:5](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/explain.ts#L5)

Shape of the failure fields Soroban RPC returns from send/get transaction.

## Properties

### errorResultXdr?

> `optional` **errorResultXdr?**: `string`

Defined in: [packages/core/src/decode/explain.ts:7](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/explain.ts#L7)

Base64 `TransactionResult` from a failed `sendTransaction`.

***

### resultXdr?

> `optional` **resultXdr?**: `string`

Defined in: [packages/core/src/decode/explain.ts:9](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/explain.ts#L9)

Base64 `TransactionResult` from `getTransaction`.

***

### status?

> `optional` **status?**: `string`

Defined in: [packages/core/src/decode/explain.ts:11](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/explain.ts#L11)

RPC status string (e.g. `'ERROR'`, `'FAILED'`), used as a fallback.
