---
title: formatScVal
description: Function formatScVal — @soroscope/core API reference.
generated: true
---

> **formatScVal**(`v`): `string`

Defined in: packages/core/src/decode/scval.ts:295

A compact, single-line, human-readable rendering of an `ScVal`, for logs and
error messages. Strings and symbols are quoted and contract-controlled text
is escaped, so it is safe to show to people and to language models.

## Parameters

### v

[`ScVal`](/docs/reference/scval)

## Returns

`string`
