---
title: eventName
description: Function eventName — @soroscope/core API reference.
generated: true
---

> **eventName**(`event`): `string` \| `null`

Defined in: packages/core/src/decode/events.ts:54

The first symbol in an event's topics, which by convention names the event
(`transfer`, `fn_call`, `fn_return`, `error`…). Null if there is none.

## Parameters

### event

[`ContractEvent`](/docs/reference/contractevent)

## Returns

`string` \| `null`
