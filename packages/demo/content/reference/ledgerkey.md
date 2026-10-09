---
title: LedgerKey
description: TypeAlias LedgerKey — @soroscope/core API reference.
generated: true
---

> **LedgerKey** = \{ `accountId`: `string`; `type`: `"account"`; \} \| \{ `accountId`: `string`; `asset`: [`Asset`](/docs/reference/asset); `type`: `"trustline"`; \} \| \{ `offerId`: `bigint`; `sellerId`: `string`; `type`: `"offer"`; \} \| \{ `accountId`: `string`; `dataName`: `string`; `type`: `"data"`; \} \| \{ `balanceId`: `string`; `type`: `"claimableBalance"`; \} \| \{ `poolId`: `string`; `type`: `"liquidityPool"`; \} \| \{ `contract`: [`ScAddress`](/docs/reference/scaddress); `durability`: [`ContractDataDurability`](/docs/reference/contractdatadurability); `key`: [`ScVal`](/docs/reference/scval); `type`: `"contractData"`; \} \| \{ `hash`: `string`; `type`: `"contractCode"`; \} \| \{ `configSettingId`: `number`; `type`: `"configSetting"`; \} \| \{ `keyHash`: `string`; `type`: `"ttl"`; \}

Defined in: packages/core/src/decode/ledger.ts:16

`LedgerKey`: identifies one ledger entry.
