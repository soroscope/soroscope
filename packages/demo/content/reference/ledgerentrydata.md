---
title: LedgerEntryData
description: TypeAlias LedgerEntryData — @soroscope/core API reference.
generated: true
---

> **LedgerEntryData** = \{ `contract`: [`ScAddress`](/docs/reference/scaddress); `durability`: [`ContractDataDurability`](/docs/reference/contractdatadurability); `key`: [`ScVal`](/docs/reference/scval); `type`: `"contractData"`; `val`: [`ScVal`](/docs/reference/scval); \} \| \{ `code`: `Uint8Array`; `costInputs`: [`ContractCodeCostInputs`](/docs/reference/contractcodecostinputs) \| `null`; `hash`: `string`; `type`: `"contractCode"`; \} \| \{ `keyHash`: `string`; `liveUntilLedgerSeq`: `number`; `type`: `"ttl"`; \}

Defined in: packages/core/src/decode/ledger.ts:189

The `data` arm of a `LedgerEntry` for the entry types Soroban cares about.
