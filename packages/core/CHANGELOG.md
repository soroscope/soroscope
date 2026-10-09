# @soroscope/core

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Until `1.0.0`, the public API may change between minor versions.

## 0.1.0

Initial release.

### Added

- **Smart RPC routing** (`RpcRouter`) — pool multiple Soroban RPC endpoints,
  rank them by measured latency, fall back to the next healthy endpoint on
  network/timeout failures, and re-check health on a configurable interval.
  Supports `await using` via `Symbol.asyncDispose`.
- **Typed JSON-RPC 2.0 client** (`RpcClient`) — single-endpoint client with
  configurable timeouts (`AbortController`-based), custom headers, and a
  `healthCheck()` helper.
- **Soroban transaction pre-flight simulation** (`TransactionSimulator`) —
  wraps `simulateTransaction` on any `RpcClient` or `RpcRouter` and returns a
  typed `SimulationResult` with the minimum resource fee, metered CPU/memory
  cost, ledger footprint, required authorizations, return value, and restore
  preamble. Includes an `estimateFee()` convenience that throws
  `SimulationError` on failure.
- **Zero-dependency XDR error decoding** — `decodeTransactionResult`,
  `decodeScError`, and `explainTransactionError` turn the opaque base64 XDR
  blobs Soroban RPC returns on failure (`errorResultXdr`, `resultXdr`, and
  `SCV_ERROR` values) into structured, human-readable explanations, including
  application-defined contract error codes. Throws `XdrDecodeError` on
  malformed input.
- **Typed error hierarchy** — `RpcNetworkError`, `RpcResponseError`,
  `RpcTimeoutError`, and `RpcParseError` for precise failure handling.
- Dual ESM + CJS build with bundled `.d.ts` type declarations.

### Known limitations

- Does not build, sign, or submit transactions, and manages no keypairs or
  accounts — use `@stellar/stellar-sdk` for the transaction lifecycle.
- XDR is decoded, not encoded.
- Soroban operation results are fully decoded; classic (non-Soroban) operation
  results are reported with `partial: true` (the transaction-level verdict is
  still accurate).
