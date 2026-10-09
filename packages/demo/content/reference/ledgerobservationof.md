---
title: ledgerObservationOf
description: Function ledgerObservationOf — @soroscope/core API reference.
generated: true
---

> **ledgerObservationOf**(`result`): [`LedgerObservation`](/docs/reference/ledgerobservation) \| `undefined`

Defined in: packages/core/src/rpc/methods.ts:97

Read the ledger bounds out of a successful response. Almost every Stellar
RPC method reports `latestLedger`; the history methods also report
`oldestLedger`. Returns undefined when the result carries neither.

## Parameters

### result

`unknown`

## Returns

[`LedgerObservation`](/docs/reference/ledgerobservation) \| `undefined`
