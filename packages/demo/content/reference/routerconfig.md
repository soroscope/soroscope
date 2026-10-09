---
title: RouterConfig
description: Interface RouterConfig — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/SoroscopeRouter.ts:15

## Properties

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:23

Most providers tried for one call. Default 3.

***

### maxLagLedgers?

> `optional` **maxLagLedgers?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:27

Largest tolerated lag behind the best provider, in ledgers. Default 3.

***

### maxWaitMs?

> `optional` **maxWaitMs?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:25

Longest the router will sleep waiting for a rate-limited provider. Default 5000.

***

### now?

> `optional` **now?**: () => `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:29

Injectable clock (epoch ms).

#### Returns

`number`

***

### providers

> **providers**: readonly (`string` \| [`ProviderInput`](/docs/reference/providerinput))[]

Defined in: packages/core/src/routing/SoroscopeRouter.ts:17

Endpoints to route across: plain URLs or full provider inputs.

***

### refreshIntervalMs?

> `optional` **refreshIntervalMs?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:21

Background `getHealth` refresh interval when `start()` is used. Default 30000.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:19

Per-request time budget in milliseconds. Default 15000.
