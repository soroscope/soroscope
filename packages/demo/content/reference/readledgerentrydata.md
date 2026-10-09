---
title: readLedgerEntryData
description: Function readLedgerEntryData — @soroscope/core API reference.
generated: true
---

> **readLedgerEntryData**(`reader`): [`LedgerEntryData`](/docs/reference/ledgerentrydata)

Defined in: packages/core/src/decode/ledger.ts:241

Read the `data` union of a `LedgerEntry`, as returned in `getLedgerEntries`.
Classic entry types (accounts, trustlines, offers…) are not decoded and
raise [XdrUnsupportedError](/docs/reference/xdrunsupportederror).

## Parameters

### reader

`XdrReader`

## Returns

[`LedgerEntryData`](/docs/reference/ledgerentrydata)
