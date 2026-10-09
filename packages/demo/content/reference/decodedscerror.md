---
title: DecodedScError
description: Interface DecodedScError — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/decode/types.ts:52](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L52)

Decoded form of a Soroban `ScError` (an `SCV_ERROR` ScVal).

## Properties

### category

> **category**: [`XdrErrorCategory`](/docs/reference/xdrerrorcategory)

Defined in: [packages/core/src/decode/types.ts:54](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L54)

Broad category — `'contract'` for app-defined errors, otherwise `'host'`.

***

### code

> **code**: `string` \| `number`

Defined in: [packages/core/src/decode/types.ts:61](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L61)

For a contract error, the contract-defined `u32` code (`contractCode`);
for any other type, the `SCErrorCode` name.

***

### contractCode

> **contractCode**: `number` \| `null`

Defined in: [packages/core/src/decode/types.ts:65](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L65)

The contract-defined error code when `isContractError`, otherwise `null`.

***

### isContractError

> **isContractError**: `boolean`

Defined in: [packages/core/src/decode/types.ts:63](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L63)

Whether this is an application-defined contract error (`SCE_CONTRACT`).

***

### message

> **message**: `string`

Defined in: [packages/core/src/decode/types.ts:67](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L67)

Human-readable explanation.

***

### type

> **type**: `string`

Defined in: [packages/core/src/decode/types.ts:56](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/decode/types.ts#L56)

`SCErrorType` name, e.g. `'Contract'`, `'WasmVm'`, `'Budget'`.
