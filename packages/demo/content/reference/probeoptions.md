---
title: ProbeOptions
description: Interface ProbeOptions — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/probe/probe.ts:11

## Properties

### burst?

> `optional` **burst?**: `number`

Defined in: packages/core/src/probe/probe.ts:21

Send this many parallel `getHealth` calls to find the rate limit. 0 disables. Default 0.

***

### intervalMs?

> `optional` **intervalMs?**: `number`

Defined in: packages/core/src/probe/probe.ts:15

Pause between samples, ms. Default 150.

***

### reach?

> `optional` **reach?**: `boolean`

Defined in: packages/core/src/probe/probe.ts:19

Measure how far back `getLedgers` really reaches. Default true.

***

### samples?

> `optional` **samples?**: `number`

Defined in: packages/core/src/probe/probe.ts:13

Sequential `getHealth` samples per provider. Default 5.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: packages/core/src/probe/probe.ts:17

Per-request time budget, ms. Default 15000.
