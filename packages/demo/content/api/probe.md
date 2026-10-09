---
title: Probing providers
description: probeProviders measures latency, lag, retention and real getLedgers reach for each provider.
---

```ts
import { probeProviders, toTable, toPrometheus, publicProviderUrls } from '@soroscope/core'

const report = await probeProviders(publicProviderUrls('mainnet'), { samples: 5 })
console.log(toTable(report))
```

Providers are probed in parallel with each other, but each provider's requests are sequential, so the probe is gentle on any one endpoint.

## Options

| | Default | |
|---|---|---|
| `samples` | `5` | Sequential `getHealth` calls per provider. |
| `intervalMs` | `150` | Pause between samples. |
| `timeoutMs` | `15000` | Per-request budget. |
| `reach` | `true` | Measure how far back `getLedgers` answers. |
| `burst` | `0` | Send this many parallel requests to find the rate limit. Off by default; it is rude to a shared endpoint. |

## What it measures

For each provider: min, p50, p95 and max latency and error count; the chain it serves (passphrase, protocol, version); `latest` and `oldest` ledger, lag behind the best provider, and the advertised window in days; and **reach**.

### Reach

`getHealth` only advertises the recent window, but some providers serve `getLedgers` from a data lake far beyond it. The probe checks the advertised oldest ledger, then walks back 14, 30, 90, 180, 365 and 730 days until the provider refuses, and bisects between the last success and the first refusal. A refusal is asked twice; if the two answers differ the provider is reported `consistent: false`.

## Report

`ProbeReport` has `providers` (best first) and a `summary` with counts. Each `ProviderProbe` has `status` (`healthy`, `degraded`, `unreachable`, `misconfigured`), `failure`, `latency`, `ledger`, `reach`, `unsupported` methods, and `burst`.

## Formats

| | |
|---|---|
| `toTable(report)` | Aligned text. `*` marks reach beyond the window, `?` an inconsistent provider. |
| `toJson(report)` | JSON. |
| `toPrometheus(report, network)` | Prometheus text exposition. Unmeasured values are omitted. |
