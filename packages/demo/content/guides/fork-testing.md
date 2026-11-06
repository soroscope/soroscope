---
title: Test against live state
description: Record a contract call's real mainnet or testnet state once, then replay it offline on the in-process engine and check it against the network's own answer.
---

`@soroscope/testing` runs a contract call against **real ledger state** without a network at test time, and tells you whether the local engine gave the answer the network gave.

> **Status: preview.** Calls are recorded against a live network and replayed offline. Forking a past ledger and carrying state from one call to the next are not built. Not on npm yet.

## Record once, replay anywhere

```ts
import { recordFork, replayFork } from '@soroscope/testing'

// Once, with a network: ask Stellar RPC to simulate each call (which tells us what
// it touches), then read exactly those ledger entries at the same ledger.
const recording = await recordFork({ rpc, networkPassphrase, source: 'G...' }, [
  { contractId: USDC, fn: 'transfer', args: [from, to, amount] },
])

// Any time, with no network: run the call on the engine against that exact state.
for (const r of replayFork(recording)) {
  r.differences // [] when the engine gave the network's own answer
}
```

Save `recording` as JSON next to your tests. A test that records on every run depends on public infrastructure and will flake; a test that replays a recording does not.

`forkAndCompare(options, calls)` does both in one step, for an ad hoc check.

Each call runs on a fresh ledger holding only what it touched, as the account it was recorded as.

## What a difference means

`differences` lists every field where the engine disagrees with the network: outcome, return value, instructions, bytes read and written, footprint, resource fee. An empty list means all of them matched. Anything else is either a bug in the engine or a change in the network's cost model, and both are worth knowing about.

## What it has been checked against

The engine reproduces live **mainnet** (protocol 29) exactly on five recorded calls:

| Call | What it exercises |
|---|---|
| XLM `name` | the native asset contract |
| XLM `balance` | a classic account entry |
| USDC `balance` | a classic trustline |
| USDC `transfer` | two trustlines written |
| Soroswap `router_get_amounts_out` | a cross-contract call into a second contract, with real WASM and pool state |

The comparison caught a real bug while this was being built. `getLedgerEntries` returns a sponsored entry's sponsorship in a separate `extXdr` field. Without it, every sponsored account and trustline is 44 bytes smaller locally, so bytes read and the fee come out wrong. If you build your own entries for `LocalNetwork.loadEntries()`, keep `extXdr`.

## Limits

- A call is forked at the ledger it was recorded at. Forking an arbitrary past ledger needs an archive source.
- A call whose live simulation fails, or touches archived entries that need restoring first, cannot be recorded: there is no footprint to fetch.
- Only the entry types the engine executes against are loaded: account, trustline, contract data and code, config settings.
- Writes stay in the fork. There is no way yet to carry one call's state into the next.
