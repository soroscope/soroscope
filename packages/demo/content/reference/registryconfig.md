---
title: RegistryConfig
description: Interface RegistryConfig — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/ProviderRegistry.ts:91

## Properties

### maxLagLedgers?

> `optional` **maxLagLedgers?**: `number`

Defined in: packages/core/src/routing/ProviderRegistry.ts:93

Largest tolerated lag, in ledgers, behind the best provider. Default 3.

***

### now?

> `optional` **now?**: () => `number`

Defined in: packages/core/src/routing/ProviderRegistry.ts:95

Injectable clock (epoch ms).

#### Returns

`number`
