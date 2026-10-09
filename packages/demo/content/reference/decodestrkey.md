---
title: decodeStrkey
description: Function decodeStrkey — @soroscope/core API reference.
generated: true
---

> **decodeStrkey**(`text`): `object`

Defined in: packages/core/src/xdr/strkey.ts:119

Decode and validate a strkey: checks the alphabet, the length and the
CRC-16 checksum. Returns the version byte and the payload.

## Parameters

### text

`string`

## Returns

`object`

### payload

> **payload**: `Uint8Array`

### version

> **version**: `number`

## Throws

If the string is not a well-formed strkey.
