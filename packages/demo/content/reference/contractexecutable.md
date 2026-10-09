---
title: ContractExecutable
description: TypeAlias ContractExecutable — @soroscope/core API reference.
generated: true
---

> **ContractExecutable** = \{ `type`: `"wasm"`; `wasmHash`: `string`; \} \| \{ `type`: `"stellarAsset"`; \}

Defined in: packages/core/src/decode/scval.ts:29

`ContractExecutable`: either WASM identified by hash, or the built-in Stellar Asset Contract.
