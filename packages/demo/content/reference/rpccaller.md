---
title: RpcCaller
description: Interface RpcCaller — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/rpc/types.ts:29](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L29)

Anything that can issue a JSON-RPC call. Both `RpcClient` (one endpoint) and
the router (many endpoints) satisfy it, so simulation, decoding and spec
code works against either.

## Methods

### call()

> **call**\<`T`\>(`method`, `params?`, `options?`): `Promise`\<`T`\>

Defined in: [packages/core/src/rpc/types.ts:30](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L30)

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
