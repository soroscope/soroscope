---
title: decodeScError
description: Function decodeScError — @soroscope/core API reference.
generated: true
---

> **decodeScError**(`input`): [`DecodedScError`](/docs/reference/decodedscerror)

Defined in: [packages/core/src/decode/scError.ts:58](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/scError.ts#L58)

Decodes a base64 (or raw byte) Soroban `ScVal` of type `SCV_ERROR` into a
human-readable [DecodedScError](/docs/reference/decodedscerror).

This is the value Soroban returns for contract panics and host failures — for
example inside `getTransaction` diagnostic events. The most common case,
`SCE_CONTRACT`, surfaces the contract-defined `u32` error code.

## Parameters

### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

Base64 `SCVal` string, or its raw bytes.

## Returns

[`DecodedScError`](/docs/reference/decodedscerror)

## Throws

If the input is malformed or is not an `SCV_ERROR` value.
