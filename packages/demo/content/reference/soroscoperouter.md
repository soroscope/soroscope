---
title: SoroscopeRouter
description: Class SoroscopeRouter — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/SoroscopeRouter.ts:100

Routes Stellar RPC calls across several providers. Unlike a latency-only
round robin it knows each provider's ledger lag, advertised retention window,
per-method history reach and rate-limit state, and only sends a request to a
provider that can actually serve it.

## Implements

- [`RpcCaller`](/docs/reference/rpccaller)

## Constructors

### Constructor

> **new SoroscopeRouter**(`config`): `SoroscopeRouter`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:110

#### Parameters

##### config

[`RouterConfig`](/docs/reference/routerconfig)

#### Returns

`SoroscopeRouter`

## Properties

### registry

> `readonly` **registry**: [`ProviderRegistry`](/docs/reference/providerregistry)

Defined in: packages/core/src/routing/SoroscopeRouter.ts:101

## Methods

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:170

#### Returns

`void`

***

### call()

> **call**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<`T`\>

Defined in: packages/core/src/routing/SoroscopeRouter.ts:203

Send a call to the best provider that can serve it, failing over on error.

#### Type Parameters

##### T

`T`

#### Parameters

##### method

`string`

##### params?

`unknown`

##### options?

[`RouterCallOptions`](/docs/reference/routercalloptions)

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`RpcCaller`](/docs/reference/rpccaller).[`call`](/docs/reference/rpccaller#call)

***

### callDetailed()

> **callDetailed**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<[`DetailedResult`](/docs/reference/detailedresult)\<`T`\>\>

Defined in: packages/core/src/routing/SoroscopeRouter.ts:207

#### Type Parameters

##### T

`T`

#### Parameters

##### method

`string`

##### params?

`unknown`

##### options?

[`RouterCallOptions`](/docs/reference/routercalloptions) = `{}`

#### Returns

`Promise`\<[`DetailedResult`](/docs/reference/detailedresult)\<`T`\>\>

***

### clientOf()

> **clientOf**(`id`): [`RpcClient`](/docs/reference/rpcclient)

Defined in: packages/core/src/routing/SoroscopeRouter.ts:332

Direct access to one provider's client (probing, diagnostics).

#### Parameters

##### id

`string`

#### Returns

[`RpcClient`](/docs/reference/rpcclient)

***

### explain()

> **explain**(`method`, `params?`, `options?`): [`RouteExplanation`](/docs/reference/routeexplanation)

Defined in: packages/core/src/routing/SoroscopeRouter.ts:314

Say which provider would be chosen for a call, and why the others would not, without calling anything.

#### Parameters

##### method

`string`

##### params?

`unknown`

##### options?

[`RouterCallOptions`](/docs/reference/routercalloptions) = `{}`

#### Returns

[`RouteExplanation`](/docs/reference/routeexplanation)

***

### fanOut()

> **fanOut**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<[`PerProviderResult`](/docs/reference/perproviderresult)\<`T`\>[]\>

Defined in: packages/core/src/routing/SoroscopeRouter.ts:280

Issue the same call to every provider in parallel, reporting each outcome.

#### Type Parameters

##### T

`T`

#### Parameters

##### method

`string`

##### params?

`unknown`

##### options?

[`RpcCallOptions`](/docs/reference/rpccalloptions)

#### Returns

`Promise`\<[`PerProviderResult`](/docs/reference/perproviderresult)\<`T`\>[]\>

***

### refresh()

> **refresh**(): `Promise`\<`void`\>

Defined in: packages/core/src/routing/SoroscopeRouter.ts:179

Read `getHealth` from every provider (and the network passphrase and
version once), updating latency, ledger bounds and status. Never throws:
a failing provider is recorded as failing.

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(): `void`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:147

Begin background health refreshes. The timer never keeps the process alive.

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: packages/core/src/routing/SoroscopeRouter.ts:164

#### Returns

`void`

***

### create()

> `static` **create**(`config`): `Promise`\<`SoroscopeRouter`\>

Defined in: packages/core/src/routing/SoroscopeRouter.ts:140

Build a router and wait for the first health reading so routing is informed from call one.

#### Parameters

##### config

[`RouterConfig`](/docs/reference/routerconfig)

#### Returns

`Promise`\<`SoroscopeRouter`\>
