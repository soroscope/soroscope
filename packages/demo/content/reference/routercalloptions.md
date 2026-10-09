---
title: RouterCallOptions
description: Interface RouterCallOptions — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/SoroscopeRouter.ts:32

## Extends

- [`RpcCallOptions`](/docs/reference/rpccalloptions)

## Properties

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:37

***

### maxWaitMs?

> `optional` **maxWaitMs?**: `number`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:38

***

### pin?

> `optional` **pin?**: `string`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:36

Pin the call to a single provider id.

***

### requires?

> `optional` **requires?**: `object`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:34

Constrain routing beyond what the method's params imply.

#### maxLagLedgers?

> `optional` **maxLagLedgers?**: `number`

#### startLedger?

> `optional` **startLedger?**: `number`

***

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [packages/core/src/rpc/types.ts:13](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L13)

#### Inherited from

[`RpcCallOptions`](/docs/reference/rpccalloptions).[`signal`](/docs/reference/rpccalloptions#signal)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [packages/core/src/rpc/types.ts:12](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L12)

Overrides the client's default time budget for this call.

#### Inherited from

[`RpcCallOptions`](/docs/reference/rpccalloptions).[`timeoutMs`](/docs/reference/rpccalloptions#timeoutms)
