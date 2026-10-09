---
title: readScError
description: Function readScError — @soroscope/core API reference.
generated: true
---

> **readScError**(`reader`): [`DecodedScError`](/docs/reference/decodedscerror)

Defined in: [packages/core/src/decode/scError.ts:19](https://github.com/soroscope/soroscope/blob/main/packages/core/src/decode/scError.ts#L19)

Reads an `ScError` union body at the reader's current position.

`union switch (SCErrorType type) { case SCE_CONTRACT: uint32 contractCode; default: SCErrorCode code; }`

Exported for reuse by other decoders (e.g. simulation diagnostics).

## Parameters

### reader

`XdrReader`

## Returns

[`DecodedScError`](/docs/reference/decodedscerror)
