---
title: DecodedOperationResult
description: Interface DecodedOperationResult — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/decode/types.ts:13](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L13)

A single operation's decoded result within a transaction.

## Properties

### code

> **code**: `string`

Defined in: [packages/core/src/decode/types.ts:15](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L15)

`OperationResultCode` name, e.g. `'opINNER'`, `'opNO_ACCOUNT'`.

***

### innerCode

> **innerCode**: `string` \| `null`

Defined in: [packages/core/src/decode/types.ts:22](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L22)

Inner per-operation result code name when the operation type is modeled
(the Soroban operations), otherwise `null`.

***

### message

> **message**: `string`

Defined in: [packages/core/src/decode/types.ts:26](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L26)

Human-readable explanation of this operation's result.

***

### operationType

> **operationType**: `string` \| `null`

Defined in: [packages/core/src/decode/types.ts:17](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L17)

`OperationType` name when `code === 'opINNER'`, otherwise `null`.

***

### successful

> **successful**: `boolean`

Defined in: [packages/core/src/decode/types.ts:24](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L24)

Whether this operation succeeded.
