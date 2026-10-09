---
title: fetchContractCode
description: Function fetchContractCode — @soroscope/core API reference.
generated: true
---

> **fetchContractCode**(`caller`, `contractId`): `Promise`\<[`ContractCode`](/docs/reference/contractcode)\>

Defined in: packages/core/src/spec/fetch.ts:79

Look up a deployed contract and download its code: the contract instance
gives the WASM hash, the hash gives the WASM.

## Parameters

### caller

[`RpcCaller`](/docs/reference/rpccaller)

### contractId

`string`

## Returns

`Promise`\<[`ContractCode`](/docs/reference/contractcode)\>

## Throws

If the instance or its code is not on the ledger.
