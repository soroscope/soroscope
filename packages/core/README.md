# @soroscope/core

Retention-aware RPC routing, XDR decoding, contract specs and decoded simulation reports for Stellar and Soroban. **Zero runtime dependencies**; it uses the platform `fetch`.

```sh
npm install @soroscope/core
```

```ts
import { SoroscopeRouter, publicProviderUrls, probeProviders, toTable } from '@soroscope/core'

// Measure what each provider really does.
console.log(toTable(await probeProviders(publicProviderUrls('mainnet'))))

// Route calls only to providers that can serve them.
const router = await SoroscopeRouter.create({ providers: publicProviderUrls('mainnet') })
const latest = await router.call<{ sequence: number }>('getLatestLedger')
```

## What is in it

| | |
|---|---|
| `SoroscopeRouter`, `ProviderRegistry` | Excludes providers that lag, lack the history, are rate limited or misconfigured; ranks the rest. [Guide](https://github.com/soroscope/soroscope/blob/main/packages/demo/content/guides/rpc-routing.md) |
| `probeProviders` | Latency, lag, retention and how far back `getLedgers` really answers. Table, JSON and Prometheus output. |
| `decodeScVal`, `decodeDiagnosticEvent`, `decodeAuthEntry`, `decodeSorobanTransactionData`, `decodeLedgerKey`, `decodeLedgerEntryData`, `decodeTransactionResult` | XDR decoders, checked against the official `stellar xdr decode` on real network data. |
| `parseWasm`, `fetchContractSpec`, `ContractSpec` | A contract's functions, types, events and named error codes. |
| `TransactionSimulator` | `simulateTransaction` returned as a decoded `SimulationReport`; failures carry the contract's error name. |
| `RpcClient` | One endpoint; reports HTTP status, `Retry-After` and latency. |

Nothing here signs or submits a transaction. To build a call to simulate, use [`@soroscope/invoke`](../invoke); for a command line, [`@soroscope/cli`](../cli).

## Requirements

Node.js 18 or newer (global `fetch`). Decoded 64-bit and larger integers are `bigint`.

## Documentation

Full documentation is in [`packages/demo/content`](https://github.com/soroscope/soroscope/tree/main/packages/demo/content) and on the docs site.

## License

MIT
