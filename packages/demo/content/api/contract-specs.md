---
title: Contract specs
description: Read a contract's functions, types, events and error codes from its WASM or from the ledger.
---

Every Soroban contract embeds a spec describing its interface. Soroscope reads it from compiled WASM or from a deployed contract.

```ts
import { fetchContractSpec, parseWasm, ContractSpec } from '@soroscope/core'

const spec = await fetchContractSpec(router, 'CC...')   // from the ledger

const parsed = parseWasm(wasmBytes)                      // from a local build
const local = new ContractSpec(parsed.spec, { kind: 'unknown' }, parsed.meta)
```

## `ContractSpec`

| | |
|---|---|
| `functions`, `structs`, `unions`, `enums`, `events` | The declared items. |
| `errors` | Every error code, flattened from the contract's error enums: `{ code, name, doc, enumName }`. |
| `function(name)` | One function and its typed inputs and outputs. |
| `lookupError(code)` | The error with that code, if exactly one enum declares it. |
| `lookupErrors(code)` | All of them (a contract may reuse a number across enums). |
| `source` | `{ kind: 'wasm', wasmHash }`, `{ kind: 'stellarAsset' }` or `{ kind: 'unknown' }`. |
| `meta` | Build metadata such as `rsver` and `rssdkver`. |

`formatSpecType(type)` renders a type the way Rust writes it.

## From the ledger

`fetchContractSpec(rpc, contractId)` reads the contract instance, then its code, then parses the WASM. It throws `ContractNotFoundError` if the contract or its code is not on the ledger (it may not exist on this network, or its storage may have been archived). A **Stellar Asset Contract** has no WASM; its spec is empty.

`fetchContractCode` returns the WASM bytes themselves, and `contractInstanceKey` / `contractCodeKey` build the `getLedgerEntries` keys.

## From WASM

`parseWasm(bytes)` walks the WebAssembly sections. A module may carry several custom sections with the same name (the Rust SDK appends metadata in pieces); they are joined in file order. It throws `XdrDecodeError` for anything that is not a well-formed module.

From the shell: `soroscope spec <contractId | file.wasm>`.
