---
title: ProviderProbe
description: Interface ProviderProbe — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/probe/probe.ts:43

## Properties

### burst

> **burst**: [`BurstResult`](/docs/reference/burstresult) \| `null`

Defined in: packages/core/src/probe/probe.ts:78

***

### failure

> **failure**: \{ `class`: [`FailureClass`](/docs/reference/failureclass); `message`: `string`; \} \| `null`

Defined in: packages/core/src/probe/probe.ts:48

***

### latency

> **latency**: [`LatencySummary`](/docs/reference/latencysummary)

Defined in: packages/core/src/probe/probe.ts:49

***

### ledger

> **ledger**: `object`

Defined in: packages/core/src/probe/probe.ts:53

#### advertisedDays

> **advertisedDays**: `number` \| `null`

Days of history the advertised window covers.

#### lag

> **lag**: `number` \| `null`

Ledgers behind the best provider in this probe run.

#### latest

> **latest**: `number` \| `null`

#### oldest

> **oldest**: `number` \| `null`

#### retentionWindow

> **retentionWindow**: `number` \| `null`

***

### passphrase

> **passphrase**: `string` \| `null`

Defined in: packages/core/src/probe/probe.ts:50

***

### protocolVersion

> **protocolVersion**: `number` \| `null`

Defined in: packages/core/src/probe/probe.ts:51

***

### provider

> **provider**: `string`

Defined in: packages/core/src/probe/probe.ts:44

***

### reach

> **reach**: `object`

Defined in: packages/core/src/probe/probe.ts:62

#### beyondWindow

> **beyondWindow**: `boolean`

True when `getLedgers` reaches meaningfully beyond the advertised window.

#### consistent

> **consistent**: `boolean`

False when the provider answered the same lookup differently on retry:
its reach is unreliable (typically a load balancer over mixed backends).

#### getLedgersDays

> **getLedgersDays**: `number` \| `null`

Days back from latest that `getLedgers` reaches.

#### getLedgersOldest

> **getLedgersOldest**: `number` \| `null`

Oldest ledger `getLedgers` was shown to serve, or null if it could not be measured.

#### lookups

> **lookups**: `number`

Ledger lookups the probe spent measuring this.

***

### reachable

> **reachable**: `boolean`

Defined in: packages/core/src/probe/probe.ts:46

***

### status

> **status**: `"misconfigured"` \| `"healthy"` \| `"degraded"` \| `"unreachable"`

Defined in: packages/core/src/probe/probe.ts:47

***

### unsupported

> **unsupported**: `string`[]

Defined in: packages/core/src/probe/probe.ts:77

***

### url

> **url**: `string`

Defined in: packages/core/src/probe/probe.ts:45

***

### version

> **version**: `string` \| `null`

Defined in: packages/core/src/probe/probe.ts:52
