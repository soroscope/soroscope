---
title: ParsedWasm
description: Interface ParsedWasm — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/spec/wasm.ts:10

## Properties

### customSections

> **customSections**: `string`[]

Defined in: packages/core/src/spec/wasm.ts:16

Names of every custom section found.

***

### envInterfaceVersion

> **envInterfaceVersion**: \{ `preRelease`: `number`; `protocol`: `number`; \} \| `null`

Defined in: packages/core/src/spec/wasm.ts:14

Soroban interface version from `contractenvmetav0`, when present.

***

### meta

> **meta**: [`ContractMeta`](/docs/reference/contractmeta)

Defined in: packages/core/src/spec/wasm.ts:12

***

### spec

> **spec**: [`SpecEntry`](/docs/reference/specentry)[]

Defined in: packages/core/src/spec/wasm.ts:11
