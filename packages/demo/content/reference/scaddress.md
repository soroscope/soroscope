---
title: ScAddress
description: Interface ScAddress — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/decode/scval.ts:22

`SCAddress`: an account, contract, muxed account, claimable balance or pool.

## Properties

### address

> **address**: `string`

Defined in: packages/core/src/decode/scval.ts:25

The strkey form: `G...`, `C...`, `M...`, `B...` or `L...`.

***

### type

> **type**: `"contract"` \| `"account"` \| `"muxedAccount"` \| `"claimableBalance"` \| `"liquidityPool"`

Defined in: packages/core/src/decode/scval.ts:23
