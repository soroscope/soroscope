---
title: ContractCode
description: Interface ContractCode — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/spec/fetch.ts:68

A deployed contract's code: its source, plus the WASM bytes when it has any.

## Properties

### source

> **source**: [`ContractSource`](/docs/reference/contractsource)

Defined in: packages/core/src/spec/fetch.ts:69

***

### wasm

> **wasm**: `Uint8Array`\<`ArrayBufferLike`\> \| `null`

Defined in: packages/core/src/spec/fetch.ts:71

The compiled module; null for the built-in Stellar Asset Contract.
