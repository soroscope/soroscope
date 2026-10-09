---
title: ScVal
description: TypeAlias ScVal — @soroscope/core API reference.
generated: true
---

> **ScVal** = \{ `type`: `"bool"`; `value`: `boolean`; \} \| \{ `type`: `"void"`; \} \| \{ `error`: [`DecodedScError`](/docs/reference/decodedscerror); `type`: `"error"`; \} \| \{ `type`: `"u32"` \| `"i32"`; `value`: `number`; \} \| \{ `type`: `"u64"` \| `"i64"` \| `"timepoint"` \| `"duration"` \| `"u128"` \| `"i128"` \| `"u256"` \| `"i256"`; `value`: `bigint`; \} \| \{ `type`: `"bytes"`; `value`: `Uint8Array`; \} \| \{ `bytes`: `Uint8Array`; `type`: `"string"`; `value`: `string`; \} \| \{ `type`: `"symbol"`; `value`: `string`; \} \| \{ `type`: `"vec"`; `value`: `ScVal`[] \| `null`; \} \| \{ `type`: `"map"`; `value`: [`ScMapEntry`](/docs/reference/scmapentry)[] \| `null`; \} \| \{ `type`: `"address"`; `value`: [`ScAddress`](/docs/reference/scaddress); \} \| \{ `executable`: [`ContractExecutable`](/docs/reference/contractexecutable); `storage`: [`ScMapEntry`](/docs/reference/scmapentry)[] \| `null`; `type`: `"contractInstance"`; \} \| \{ `type`: `"ledgerKeyContractInstance"`; \} \| \{ `nonce`: `bigint`; `type`: `"ledgerKeyNonce"`; \}

Defined in: packages/core/src/decode/scval.ts:39

A decoded Soroban `ScVal`, as a tagged union. 64-bit and larger integers are `bigint`.
