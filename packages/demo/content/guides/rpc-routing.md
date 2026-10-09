---
title: Retention-aware RPC routing
description: How the router picks a provider, why it sometimes refuses to, and how to see its reasoning.
---

A plain fallback list sends a request to the fastest provider and moves on if it fails. That is wrong for requests only some providers can answer: a refusal for "ledger too old" is not a failure of the provider, and retrying the same request on a second provider with the same window just burns quota.

`SoroscopeRouter` decides which providers *can* serve a request first, then ranks them.

## The decision

For each call, in order:

1. **Network.** Providers on a different network (by passphrase) are out.
2. **Health.** Providers that are `unreachable` (circuit open), `limited` (rate limited), or `misconfigured` (401/403/404) are out.
3. **Method support.** A provider that answered "method not found" for this method is out.
4. **Freshness**, for methods that read current state (`simulateTransaction`, `getLedgerEntries`, `getLatestLedger`, `sendTransaction`): providers more than three ledgers behind the best provider are out.
5. **History**, for `getEvents`, `getTransactions` and `getLedgers`: the provider must be able to serve the oldest ledger the call needs. `getLedgers` is allowed to reach beyond the advertised window when a provider has shown it can.
6. The survivors are **ranked** by p95 latency (or a smoothed average with few samples), penalised for lag and degraded status.

If nothing survives, you get a `NoEligibleProviderError` whose `excluded` list says why each provider was ruled out.

```ts
import { SoroscopeRouter, NoEligibleProviderError, publicProviderUrls } from '@soroscope/core'

const router = await SoroscopeRouter.create({ providers: publicProviderUrls('testnet') })

try {
  await router.call('getEvents', { startLedger: 1000, filters: [], pagination: { limit: 1 } })
} catch (err) {
  if (err instanceof NoEligibleProviderError) {
    for (const e of err.excluded) console.log(e.provider, '-', e.reason)
    // soroban-testnet.stellar.org - ledger 1000 is older than its oldest servable ledger 4982834
  }
}
```

## Failing over

When a provider does fail, the failure class decides what happens:

| Class | Cause | Effect |
|---|---|---|
| `rate_limited` | HTTP 429, or 503 with `Retry-After` | Cool down for the `Retry-After` time (or an exponential back-off); not counted as a failure. |
| `server`, `timeout`, `network`, `protocol` | Provider trouble | Counts toward a circuit breaker: three in a row opens it, with a doubling cool-down. |
| `auth`, `misconfigured` | 401/403, 404/405 | Provider is marked misconfigured until it succeeds. |
| `out_of_retention` | "ledger out of range" | The range in the message updates what the router knows about that provider; the next provider is tried. |
| `unsupported_method` | `-32601` | Remembered; the provider is skipped for that method. |
| `invalid_request` | Bad parameters | **Not retried.** Every provider would refuse it the same way. |

`sendTransaction` is only retried on another provider after a *transport* failure, when the first node provably never received it.

## Seeing the reasoning

`router.explain(method, params)` returns the ranking and the exclusions **without making a call**. From the shell:

```sh
soroscope route-explain getEvents --network testnet --start-ledger 1000
```

`router.callDetailed()` returns which provider answered and every attempt made. `router.registry.snapshot()` is a JSON-safe dump of everything the router knows.

## Running it long-lived

`SoroscopeRouter.create()` waits for a first health reading. `router.start()` then refreshes in the background (every 30 seconds by default, jittered). The timer does not keep your process alive. Call `router.stop()` when done.
