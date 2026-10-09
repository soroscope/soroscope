---
title: ProviderInput
description: Interface ProviderInput — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/ProviderRegistry.ts:43

## Properties

### headers?

> `optional` **headers?**: `Record`\<`string`, `string`\>

Defined in: packages/core/src/routing/ProviderRegistry.ts:49

***

### id?

> `optional` **id?**: `string`

Defined in: packages/core/src/routing/ProviderRegistry.ts:45

Stable identifier; defaults to the URL's host + path.

***

### url

> **url**: `string`

Defined in: packages/core/src/routing/ProviderRegistry.ts:46

***

### weight?

> `optional` **weight?**: `number`

Defined in: packages/core/src/routing/ProviderRegistry.ts:48

Higher weight attracts more traffic. Default 1.
