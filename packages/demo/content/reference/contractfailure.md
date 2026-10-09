---
title: ContractFailure
description: Interface ContractFailure — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/spec/contractError.ts:8

The error a failed call raised, with names filled in from the contract's own spec.

## Properties

### ambiguous

> **ambiguous**: `boolean`

Defined in: packages/core/src/spec/contractError.ts:22

True when more than one error enum in the spec uses this code.

***

### contractId

> **contractId**: `string` \| `null`

Defined in: packages/core/src/spec/contractError.ts:10

The contract that raised the error, when the event says.

***

### details

> **details**: [`ScVal`](/docs/reference/scval)[]

Defined in: packages/core/src/spec/contractError.ts:15

The rest of the event data: the values the contract reported alongside the error.

***

### error

> **error**: [`DecodedScError`](/docs/reference/decodedscerror)

Defined in: packages/core/src/spec/contractError.ts:11

***

### errorDoc

> **errorDoc**: `string` \| `null`

Defined in: packages/core/src/spec/contractError.ts:18

***

### errorEnum

> **errorEnum**: `string` \| `null`

Defined in: packages/core/src/spec/contractError.ts:20

The spec's error enum this code belongs to.

***

### errorName

> **errorName**: `string` \| `null`

Defined in: packages/core/src/spec/contractError.ts:17

The error's name from the contract spec (e.g. `InsufficientBalance`), when known.

***

### message

> **message**: `string` \| `null`

Defined in: packages/core/src/spec/contractError.ts:13

Human-readable text the contract attached (first string in the event data).
