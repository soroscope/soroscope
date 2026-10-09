---
title: fetchContractSpec
description: Function fetchContractSpec — @soroscope/core API reference.
generated: true
---

> **fetchContractSpec**(`caller`, `contractId`): `Promise`\<[`ContractSpec`](/docs/reference/contractspec)\>

Defined in: packages/core/src/spec/fetch.ts:96

Look up a deployed contract and read its spec. Stellar Asset Contracts have
no WASM and yield an empty spec.

## Parameters

### caller

[`RpcCaller`](/docs/reference/rpccaller)

### contractId

`string`

## Returns

`Promise`\<[`ContractSpec`](/docs/reference/contractspec)\>

## Throws

If the instance or its code is not on the ledger.
