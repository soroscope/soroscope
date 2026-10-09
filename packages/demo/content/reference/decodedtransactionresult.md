---
title: DecodedTransactionResult
description: Interface DecodedTransactionResult — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/decode/types.ts:30](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L30)

Decoded form of a base64 `TransactionResult` XDR blob.

## Properties

### code

> **code**: `string`

Defined in: [packages/core/src/decode/types.ts:34](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L34)

`TransactionResultCode` name, e.g. `'txFAILED'`, `'txBAD_SEQ'`.

***

### feeCharged

> **feeCharged**: `bigint`

Defined in: [packages/core/src/decode/types.ts:32](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L32)

Fee charged for the transaction, in stroops.

***

### message

> **message**: `string`

Defined in: [packages/core/src/decode/types.ts:38](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L38)

Human-readable explanation of the transaction-level result.

***

### operations

> **operations**: [`DecodedOperationResult`](/docs/reference/decodedoperationresult)[]

Defined in: [packages/core/src/decode/types.ts:40](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L40)

Per-operation results (empty for tx-level failures that carry no op results).

***

### partial

> **partial**: `boolean`

Defined in: [packages/core/src/decode/types.ts:46](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L46)

`true` when decoding stopped early because an operation type is not modeled
by this zero-dependency decoder. The transaction-level result is still
accurate; `operations` may be incomplete.

***

### raw

> **raw**: `string`

Defined in: [packages/core/src/decode/types.ts:48](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L48)

The original base64 input, retained for round-trip/debugging.

***

### successful

> **successful**: `boolean`

Defined in: [packages/core/src/decode/types.ts:36](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/types.ts#L36)

Whether the transaction as a whole succeeded.
