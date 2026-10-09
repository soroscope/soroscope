---
title: ContractEvent
description: Interface ContractEvent — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/decode/events.ts:10

A decoded `ContractEvent`. `contractId` is null for events not tied to a contract.

## Properties

### contractId

> **contractId**: `string` \| `null`

Defined in: packages/core/src/decode/events.ts:12

***

### data

> **data**: [`ScVal`](/docs/reference/scval)

Defined in: packages/core/src/decode/events.ts:14

***

### topics

> **topics**: [`ScVal`](/docs/reference/scval)[]

Defined in: packages/core/src/decode/events.ts:13

***

### type

> **type**: [`ContractEventType`](/docs/reference/contracteventtype)

Defined in: packages/core/src/decode/events.ts:11
