---
title: parseErrorText
description: Function parseErrorText — @soroscope/core API reference.
generated: true
---

> **parseErrorText**(`text`): \{ `code`: `string`; `type`: `string`; \} \| `null`

Defined in: packages/core/src/spec/contractError.ts:72

Pull the `Error(Type, Code)` out of a simulation error string. Use it only
when the diagnostic events are not available; the events carry more.

## Parameters

### text

`string`

## Returns

\{ `code`: `string`; `type`: `string`; \} \| `null`
