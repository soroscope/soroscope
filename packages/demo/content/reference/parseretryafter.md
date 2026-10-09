---
title: parseRetryAfter
description: Function parseRetryAfter — @soroscope/core API reference.
generated: true
---

> **parseRetryAfter**(`value`, `now?`): `number` \| `undefined`

Defined in: [packages/core/src/rpc/errors.ts:124](https://github.com/ezedike-evan/stellar-lens/blob/main/packages/core/src/rpc/errors.ts#L124)

Parse an HTTP `Retry-After` header (delta-seconds or HTTP-date) into
milliseconds. Returns undefined for absent or unparseable values and clamps
the result to one hour so a hostile or buggy header cannot park a provider
forever.

## Parameters

### value

`string` \| `null` \| `undefined`

### now?

`number` = `...`

## Returns

`number` \| `undefined`
