---
title: parseWasm
description: Function parseWasm — @soroscope/core API reference.
generated: true
---

> **parseWasm**(`wasm`): [`ParsedWasm`](/docs/reference/parsedwasm)

Defined in: packages/core/src/spec/wasm.ts:94

Extract the contract spec, metadata and environment version from a compiled
Soroban contract. A module without a spec section yields an empty spec.

## Parameters

### wasm

`Uint8Array`

## Returns

[`ParsedWasm`](/docs/reference/parsedwasm)

## Throws

If the bytes are not a well-formed WebAssembly module.
