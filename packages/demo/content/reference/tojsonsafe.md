---
title: toJsonSafe
description: Function toJsonSafe — @soroscope/core API reference.
generated: true
---

> **toJsonSafe**(`value`): `unknown`

Defined in: packages/core/src/decode/json.ts:7

Convert a decoded value into something `JSON.stringify` can carry: bigints
become decimal strings and byte arrays become hex. Everything else is kept.

## Parameters

### value

`unknown`

## Returns

`unknown`
