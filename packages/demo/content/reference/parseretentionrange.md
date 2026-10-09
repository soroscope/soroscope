---
title: parseRetentionRange
description: Function parseRetentionRange — @soroscope/core API reference.
generated: true
---

> **parseRetentionRange**(`message`): [`RetentionRange`](/docs/reference/retentionrange) \| `null`

Defined in: packages/core/src/rpc/classify.ts:52

Extract the valid ledger range from an out-of-range error message.
Returns null when the message is not an out-of-range rejection.

## Parameters

### message

`string`

## Returns

[`RetentionRange`](/docs/reference/retentionrange) \| `null`
