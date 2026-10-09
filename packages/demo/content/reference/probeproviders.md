---
title: probeProviders
description: Function probeProviders — @soroscope/core API reference.
generated: true
---

> **probeProviders**(`providers`, `options?`): `Promise`\<[`ProbeReport`](/docs/reference/probereport)\>

Defined in: packages/core/src/probe/probe.ts:339

Probe providers in parallel and report, per provider: latency distribution,
ledger lag against the best provider, advertised retention, how far back
`getLedgers` really reaches, and optionally its rate-limit behaviour.
Providers are probed concurrently with each other but each provider's
requests are sequential, so the probe is gentle on any one endpoint.

## Parameters

### providers

readonly (`string` \| [`ProviderInput`](/docs/reference/providerinput))[]

### options?

[`ProbeOptions`](/docs/reference/probeoptions) = `{}`

## Returns

`Promise`\<[`ProbeReport`](/docs/reference/probereport)\>
