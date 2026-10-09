---
title: RawStateChange
description: Interface RawStateChange — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/simulation/types.ts:16

A ledger entry change the simulation predicts.

## Properties

### after?

> `optional` **after?**: `string` \| `null`

Defined in: packages/core/src/simulation/types.ts:23

Base64 `LedgerEntry` after the call (absent for `deleted`).

***

### before?

> `optional` **before?**: `string` \| `null`

Defined in: packages/core/src/simulation/types.ts:21

Base64 `LedgerEntry` before the call (absent for `created`).

***

### key

> **key**: `string`

Defined in: packages/core/src/simulation/types.ts:19

Base64 `LedgerKey`.

***

### type

> **type**: `"created"` \| `"updated"` \| `"deleted"`

Defined in: packages/core/src/simulation/types.ts:17
