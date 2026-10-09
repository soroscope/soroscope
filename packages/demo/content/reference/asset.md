---
title: Asset
description: TypeAlias Asset — @soroscope/core API reference.
generated: true
---

> **Asset** = \{ `type`: `"native"`; \} \| \{ `code`: `string`; `issuer`: `string`; `type`: `"credit"`; \} \| \{ `poolId`: `string`; `type`: `"poolShare"`; \}

Defined in: packages/core/src/decode/ledger.ts:8

A classic asset (as used by trustlines and contract id preimages).
