---
title: SorobanTransactionData
description: Interface SorobanTransactionData — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/decode/sorobanData.ts:21

A decoded `SorobanTransactionData`: what a transaction declares it will touch and spend.

## Properties

### archivedEntries

> **archivedEntries**: `number`[]

Defined in: packages/core/src/decode/sorobanData.ts:26

Indexes of footprint entries that are archived and must be restored first (ext v1).

***

### resourceFee

> **resourceFee**: `bigint`

Defined in: packages/core/src/decode/sorobanData.ts:24

Resource fee in stroops.

***

### resources

> **resources**: [`SorobanResources`](/docs/reference/sorobanresources)

Defined in: packages/core/src/decode/sorobanData.ts:22
