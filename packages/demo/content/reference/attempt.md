---
title: Attempt
description: Interface Attempt — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/rpc/errors.ts:77](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/errors.ts#L77)

One try against one provider, as recorded by the router.

## Properties

### failure?

> `optional` **failure?**: `string`

Defined in: [packages/core/src/rpc/errors.ts:82](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/errors.ts#L82)

Failure class, present when `ok` is false.

***

### latencyMs

> **latencyMs**: `number`

Defined in: [packages/core/src/rpc/errors.ts:80](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/errors.ts#L80)

***

### message?

> `optional` **message?**: `string`

Defined in: [packages/core/src/rpc/errors.ts:83](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/errors.ts#L83)

***

### ok

> **ok**: `boolean`

Defined in: [packages/core/src/rpc/errors.ts:79](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/errors.ts#L79)

***

### provider

> **provider**: `string`

Defined in: [packages/core/src/rpc/errors.ts:78](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/errors.ts#L78)
