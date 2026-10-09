---
title: StateChange
description: Interface StateChange — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/simulation/types.ts:48

## Properties

### after

> **after**: `string` \| `null`

Defined in: packages/core/src/simulation/types.ts:54

Base64 `LedgerEntry` after the call.

***

### before

> **before**: `string` \| `null`

Defined in: packages/core/src/simulation/types.ts:52

Base64 `LedgerEntry` before the call.

***

### key

> **key**: [`LedgerKey`](/docs/reference/ledgerkey)

Defined in: packages/core/src/simulation/types.ts:50

***

### type

> **type**: `"created"` \| `"updated"` \| `"deleted"`

Defined in: packages/core/src/simulation/types.ts:49
