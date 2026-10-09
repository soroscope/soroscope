---
title: canonicalLedgerKey
description: Function canonicalLedgerKey — @soroscope/core API reference.
generated: true
---

> **canonicalLedgerKey**(`key`, `aliases?`): `string`

Defined in: packages/core/src/decode/ledger.ts:146

A stable, human-readable, single-line identity for a ledger key. Two keys
are the same entry exactly when their canonical strings are equal, so it is
safe to use for sorting, diffing footprints and baselines. `aliases` maps
contract ids to short names (for contracts whose id changes per run).

## Parameters

### key

[`LedgerKey`](/docs/reference/ledgerkey)

### aliases?

`Readonly`\<`Record`\<`string`, `string`\>\> = `{}`

## Returns

`string`
