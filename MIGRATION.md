# Migrating from `stellar-lens`

`stellar-lens` is replaced by the `@soroscope/*` packages. This was a rewrite, not a rename, so the API differs.

## Package names

| Was | Now |
|---|---|
| `stellar-lens` | `@soroscope/core` (plus `@soroscope/invoke` to build calls) |
| (none) | `@soroscope/cli`, `@soroscope/ci`, `@soroscope/mcp` |

Node 20 or newer is required; `@soroscope/invoke`, `ci` and `mcp` need 22 or newer.

## API mapping

| `stellar-lens` | Soroscope |
|---|---|
| `new RpcRouter({ endpoints })` | `await SoroscopeRouter.create({ providers })` |
| `router.start()` | `router.start()` (background refresh). `create()` already waited for a first health reading, so there is nothing to await. |
| `router.getHealthySummary()` | `router.registry.list()` |
| `RpcClient` | `RpcClient` (now `timeoutMs`, and `callRaw()` for HTTP status and latency) |
| `RpcParseError` | `RpcProtocolError` |
| `RpcNetworkError` for any HTTP failure | `RpcHttpError` (with `status` and `retryAfterMs`) for non-2xx; `RpcNetworkError` only when no response arrived |
| `TransactionSimulator.simulate()` returning `SimulationResult` | Returns `SimulationReport`: decoded return value, events, auth, footprint and resources |
| `result.success` | `report.ok` |
| `result.cost?.cpuInstructions` | `report.transactionData.resources.instructions` |
| `result.cost?.memoryBytes` | **Removed.** Current RPC responses carry no memory figure. |
| `result.returnValueXdr` (base64) | `report.returnValue` (decoded `ScVal`) |
| `result.events` (base64 strings) | `report.events` (decoded) |
| `decodeTransactionResult`, `decodeScError`, `explainTransactionError` | Unchanged |

## Behaviour changes worth knowing

- The router no longer round-robins. It excludes providers that cannot serve a request (too much lag, too little history, rate limited, misconfigured) and ranks the rest.
- A request no provider can serve now throws `NoEligibleProviderError` instead of being sent anyway.
- `invalid_request` errors (bad parameters) are no longer retried on other providers.
- `fallbackOnFailure` is gone; it was never read.
- The previous docs listed several public providers. Some of them (for example `rpc.ankr.com/stellar_testnet`) need an API key and were never usable unauthenticated. `publicProviderUrls()` lists only endpoints that were seen working.

## Deprecating the old package

If you published `stellar-lens` to npm, point it at its replacement:

```sh
npm deprecate stellar-lens "Renamed and rewritten as @soroscope/core. See https://github.com/ezedike-evan/soroscope/blob/main/MIGRATION.md"
```
