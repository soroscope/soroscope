---
title: RpcClient
description: Class RpcClient — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/rpc/RpcClient.ts:23](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/rpc/RpcClient.ts#L23)

JSON-RPC 2.0 client for a single Stellar RPC endpoint. It does no retrying
and no failover: it reports exactly what happened (HTTP status, Retry-After,
latency, JSON-RPC error) so a router above it can decide what to do.

## Implements

- [`RpcCaller`](/docs/reference/rpccaller)

## Constructors

### Constructor

> **new RpcClient**(`config`): `RpcClient`

Defined in: [packages/core/src/rpc/RpcClient.ts:30](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/rpc/RpcClient.ts#L30)

#### Parameters

##### config

[`RpcClientConfig`](/docs/reference/rpcclientconfig)

#### Returns

`RpcClient`

## Properties

### url

> `readonly` **url**: `string`

Defined in: [packages/core/src/rpc/RpcClient.ts:24](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/rpc/RpcClient.ts#L24)

## Methods

### call()

> **call**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<`T`\>

Defined in: [packages/core/src/rpc/RpcClient.ts:41](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/rpc/RpcClient.ts#L41)

Call a method and return only its `result`.

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

`Promise`\<`T`\>

#### Implementation of

[`RpcCaller`](/docs/reference/rpccaller).[`call`](/docs/reference/rpccaller#call)

***

### callRaw()

> **callRaw**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<[`RpcRawResult`](/docs/reference/rpcrawresult)\<`T`\>\>

Defined in: [packages/core/src/rpc/RpcClient.ts:46](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/rpc/RpcClient.ts#L46)

Call a method and return the result together with transport details.

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

`Promise`\<[`RpcRawResult`](/docs/reference/rpcrawresult)\<`T`\>\>
