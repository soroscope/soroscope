---
title: ProviderRecord
description: Interface ProviderRecord — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/ProviderRegistry.ts:52

## Properties

### chain

> **chain**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:73

#### passphrase

> **passphrase**: `string` \| `null`

#### protocolVersion

> **protocolVersion**: `number` \| `null`

#### version

> **version**: `string` \| `null`

***

### circuit

> **circuit**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:79

#### consecutiveFailures

> **consecutiveFailures**: `number`

#### lastError

> **lastError**: \{ `at`: `number`; `class`: [`FailureClass`](/docs/reference/failureclass); `message`: `string`; \} \| `null`

#### opens

> **opens**: `number`

#### openUntil

> **openUntil**: `number` \| `null`

#### state

> **state**: `"closed"` \| `"open"` \| `"half-open"`

***

### counters

> **counters**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:88

#### byClass

> **byClass**: `Partial`\<`Record`\<[`FailureClass`](/docs/reference/failureclass), `number`\>\>

#### ok

> **ok**: `number`

#### requests

> **requests**: `number`

***

### headers

> **headers**: `Record`\<`string`, `string`\> \| `undefined`

Defined in: packages/core/src/routing/ProviderRegistry.ts:56

***

### id

> **id**: `string`

Defined in: packages/core/src/routing/ProviderRegistry.ts:53

***

### latency

> **latency**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:58

#### heavy

> **heavy**: [`LatencyStat`](/docs/reference/latencystat)

#### light

> **light**: [`LatencyStat`](/docs/reference/latencystat)

***

### ledger

> **ledger**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:59

#### latest

> **latest**: `number` \| `null`

#### observedAt

> **observedAt**: `number`

Epoch ms at which `latest`/`oldest` were observed.

#### oldest

> **oldest**: `number` \| `null`

#### retentionWindow

> **retentionWindow**: `number` \| `null`

***

### misconfigured

> **misconfigured**: `boolean`

Defined in: packages/core/src/routing/ProviderRegistry.ts:87

***

### rateLimit

> **rateLimit**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:78

#### consecutive

> **consecutive**: `number`

#### limitedUntil

> **limitedUntil**: `number` \| `null`

***

### reach

> **reach**: `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:72

The oldest ledger known to be servable by `getLedgers`, learned from probes
and successful calls. `null` means "unknown: assume the advertised window".
Expires after REACH\_TTL\_MS, because the same endpoint can answer
differently over time.

#### getLedgers

> **getLedgers**: `number` \| `null`

#### observedAt

> **observedAt**: `number`

***

### status

> **status**: [`ProviderStatus`](/docs/reference/providerstatus)

Defined in: packages/core/src/routing/ProviderRegistry.ts:57

***

### unsupportedMethods

> **unsupportedMethods**: `string`[]

Defined in: packages/core/src/routing/ProviderRegistry.ts:86

***

### url

> **url**: `string`

Defined in: packages/core/src/routing/ProviderRegistry.ts:54

***

### weight

> **weight**: `number`

Defined in: packages/core/src/routing/ProviderRegistry.ts:55
