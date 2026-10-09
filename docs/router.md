<!-- Generated from packages/demo/content/api/router.md by scripts/sync-docs.mjs. Do not edit directly; run `pnpm docs:sync`. -->

# SoroscopeRouter

```ts
import { SoroscopeRouter } from '@soroscope/core'
```

See [Retention-aware RPC routing](/docs/guides/rpc-routing) for the behaviour. This page is the reference.

## Creating

```ts
const router = await SoroscopeRouter.create({
  providers: ['https://soroban-testnet.stellar.org', { url: 'https://my.rpc', weight: 3, headers: { authorization: '...' } }],
})
```

`create()` waits for a first `getHealth` reading from every provider. `new SoroscopeRouter(config)` does not; use it when you want no startup traffic.

### `RouterConfig`

| Field | Default | |
|---|---|---|
| `providers` | required | URLs or `{ id?, url, weight?, headers? }`. Higher `weight` attracts more traffic. |
| `timeoutMs` | `15000` | Per-request time budget. |
| `refreshIntervalMs` | `30000` | Background health refresh with `start()`. |
| `maxAttempts` | `3` | Most providers tried for one call. |
| `maxWaitMs` | `5000` | Longest it will sleep for a rate-limited provider to recover. |
| `maxLagLedgers` | `3` | Largest tolerated lag for state-reading calls. |

## Methods

| | |
|---|---|
| `call(method, params?, options?)` | Route a call and return the result. |
| `callDetailed(...)` | Also return which provider answered and every attempt. |
| `fanOut(method, params?)` | Send the same call to every provider; report each outcome. Used by the probe. |
| `explain(method, params?, options?)` | Ranking and exclusions, without a call. |
| `refresh()` | Re-read `getHealth` from every provider. Never throws. |
| `start()` / `stop()` | Background refresh. The timer does not keep the process alive. |
| `registry` | The `ProviderRegistry`. |

`options` accepts `requires: { startLedger, maxLagLedgers }`, `pin` (a provider id), `maxAttempts`, `maxWaitMs`, `timeoutMs` and `signal`.

## Errors

| | |
|---|---|
| `NoEligibleProviderError` | No provider can serve the request. `excluded` has each provider and the reason. |
| `AllProvidersFailedError` | Every eligible provider was tried and failed. `attempts` has each one. |

Transport errors (`RpcNetworkError`, `RpcTimeoutError`, `RpcHttpError`, `RpcProtocolError`, `RpcResponseError`) all extend `RpcError`. `RpcHttpError` keeps the HTTP `status` and parsed `retryAfterMs`.

## `ProviderRegistry`

The state machine behind the router. It does no I/O and takes its clock as a parameter, so it is deterministic. `registry.list()` returns a `ProviderRecord` per provider: status, p95 and smoothed latency (separately for light and heavy calls), ledger bounds and lag, `getLedgers` reach, rate-limit and circuit state, unsupported methods, and counters. `snapshot()` and `ProviderRegistry.restore()` round-trip through JSON.

## Single endpoint

`RpcClient` talks to one endpoint and reports exactly what happened (HTTP status, `Retry-After`, latency, JSON-RPC error). It does no retrying.

```ts
import { RpcClient } from '@soroscope/core'

const client = new RpcClient({ url: 'https://soroban-testnet.stellar.org' })
const raw = await client.callRaw('getHealth')
raw.httpStatus   // 200
raw.latencyMs    // measured
raw.result       // { status: 'healthy', latestLedger: ..., oldestLedger: ... }
```
