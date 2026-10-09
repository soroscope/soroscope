---
title: MethodProfile
description: Interface MethodProfile — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/rpc/methods.ts:25

## Properties

### history

> **history**: [`HistoryKind`](/docs/reference/historykind)

Defined in: packages/core/src/rpc/methods.ts:30

***

### needsFresh

> **needsFresh**: `boolean`

Defined in: packages/core/src/rpc/methods.ts:29

The method reads current state, so a provider that lags the network is a poor choice.

***

### weight

> **weight**: `"light"` \| `"heavy"`

Defined in: packages/core/src/rpc/methods.ts:27

Light calls feed the light latency statistics, heavy calls the heavy ones.
