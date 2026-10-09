---
title: contractInstanceKey
description: Function contractInstanceKey — @soroscope/core API reference.
generated: true
---

> **contractInstanceKey**(`contractId`): `string`

Defined in: packages/core/src/spec/fetch.ts:28

The base64 `LedgerKey` for a contract's instance entry, the key
`getLedgerEntries` needs to look the contract up.

## Parameters

### contractId

`string`

## Returns

`string`

## Throws

If `contractId` is not a valid `C...` address.
