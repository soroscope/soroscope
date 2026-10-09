---
title: SpecType
description: TypeAlias SpecType — @soroscope/core API reference.
generated: true
---

> **SpecType** = \{ `kind`: `"val"` \| `"bool"` \| `"void"` \| `"error"` \| `"u32"` \| `"i32"` \| `"u64"` \| `"i64"` \| `"timepoint"` \| `"duration"` \| `"u128"` \| `"i128"` \| `"u256"` \| `"i256"` \| `"bytes"` \| `"string"` \| `"symbol"` \| `"address"` \| `"muxedAddress"`; \} \| \{ `kind`: `"option"`; `value`: `SpecType`; \} \| \{ `error`: `SpecType`; `kind`: `"result"`; `ok`: `SpecType`; \} \| \{ `element`: `SpecType`; `kind`: `"vec"`; \} \| \{ `key`: `SpecType`; `kind`: `"map"`; `value`: `SpecType`; \} \| \{ `elements`: `SpecType`[]; `kind`: `"tuple"`; \} \| \{ `kind`: `"bytesN"`; `n`: `number`; \} \| \{ `kind`: `"udt"`; `name`: `string`; \}

Defined in: packages/core/src/spec/entries.ts:5

`SCSpecTypeDef`: a type as the contract declares it.
