---
title: RpcClientConfig
description: Interface RpcClientConfig — @soroscope/core API reference.
generated: true
---

Defined in: [packages/core/src/rpc/types.ts:1](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L1)

## Properties

### fetch?

> `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [packages/core/src/rpc/types.ts:7](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L7)

Override the fetch implementation (custom runtimes, proxies). Defaults to global fetch.

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`URL` \| `RequestInfo`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` \| `URL` \| `Request`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

***

### headers?

> `optional` **headers?**: `Record`\<`string`, `string`\>

Defined in: [packages/core/src/rpc/types.ts:5](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L5)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [packages/core/src/rpc/types.ts:4](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L4)

Per-request time budget in milliseconds. Default 30000.

***

### url

> **url**: `string`

Defined in: [packages/core/src/rpc/types.ts:2](https://github.com/soroscope/soroscope/blob/main/packages/core/src/rpc/types.ts#L2)
