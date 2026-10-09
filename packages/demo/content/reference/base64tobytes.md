---
title: base64ToBytes
description: Function base64ToBytes — @soroscope/core API reference.
generated: true
---

> **base64ToBytes**(`input`): `Uint8Array`

Defined in: [packages/core/src/xdr/base64.ts:32](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/xdr/base64.ts#L32)

Decodes a standard base64 string into raw bytes.

Surrounding ASCII whitespace is ignored. Padding (`=`) is optional but, when
present, must be well-formed.

## Parameters

### input

`string`

## Returns

`Uint8Array`

## Throws

If the input contains a non-base64 character or has an
  invalid length.
