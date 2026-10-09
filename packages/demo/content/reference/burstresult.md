---
title: BurstResult
description: Interface BurstResult — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/probe/probe.ts:33

## Properties

### firstRateLimitAt

> **firstRateLimitAt**: `number` \| `null`

Defined in: packages/core/src/probe/probe.ts:37

***

### headers

> **headers**: `Record`\<`string`, `string`\>

Defined in: packages/core/src/probe/probe.ts:40

`x-ratelimit-*` / `ratelimit-*` response headers, when present.

***

### ok

> **ok**: `number`

Defined in: packages/core/src/probe/probe.ts:35

***

### rateLimited

> **rateLimited**: `number`

Defined in: packages/core/src/probe/probe.ts:36

***

### requests

> **requests**: `number`

Defined in: packages/core/src/probe/probe.ts:34

***

### retryAfterMs

> **retryAfterMs**: `number` \| `null`

Defined in: packages/core/src/probe/probe.ts:38
