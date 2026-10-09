---
title: findFailure
description: Function findFailure — @soroscope/core API reference.
generated: true
---

> **findFailure**(`events`): [`ContractFailure`](/docs/reference/contractfailure) \| `null`

Defined in: packages/core/src/spec/contractError.ts:30

Find the error in a list of diagnostic events. By convention a failing call
emits an event `[error, <Error value>]` from the contract that raised it,
with data `[message, ...details]`. Returns the first such event (the root cause).

## Parameters

### events

readonly [`DiagnosticEvent`](/docs/reference/diagnosticevent)[]

## Returns

[`ContractFailure`](/docs/reference/contractfailure) \| `null`
