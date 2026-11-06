# @soroscope/testing

Run contract calls against **live network state** on the in-process engine, and check the engine against the network.

| Status | |
|---|---|
| Maturity | **preview**: calls are recorded against a live network and replayed offline; a past ledger and writing state back are not built |
| Published | no (private until `@soroscope/dev` ships) |

## How it works

```ts
import { recordFork, replayFork } from '@soroscope/testing';

// Once, with a network: ask Stellar RPC to simulate each call (which tells us what it touches),
// then read exactly those ledger entries at the same ledger.
const recording = await recordFork({ rpc, networkPassphrase, source: 'G...' }, [
  { contractId: USDC, fn: 'transfer', args: [from, to, amount] },
]);

// Any time, with no network: run the call on the engine against that exact state.
for (const r of replayFork(recording)) {
  r.differences; // [] when the engine gave the network's own answer
}
```

`forkAndCompare(options, calls)` does both for an ad hoc check. Tests should record once and replay the recording, so they do not depend on the network. Each call runs on a fresh ledger holding only what it touched, as the account it was recorded as.

## What it has been checked against

[`tests/fixtures/fork-mainnet.json`](./tests/fixtures/fork-mainnet.json) was recorded from **live mainnet** (protocol 29) by [`record-fork-parity.mjs`](../test-utils/scripts/record-fork-parity.mjs). The engine reproduces the network's own answer on all five calls: outcome, return value, instructions, bytes read and written, footprint and resource fee.

| Call | What it exercises |
|---|---|
| XLM `name` | the native asset contract |
| XLM `balance` | a classic account entry |
| USDC `balance` | a classic trustline |
| USDC `transfer` | two trustlines written |
| Soroswap `router_get_amounts_out` | a cross-contract call into a second contract, with real WASM and pool state |

The comparison has teeth: it caught a real bug while this was being built. `getLedgerEntries` returns a sponsored entry's sponsorship in a separate `extXdr` field; without it every sponsored account and trustline is 44 bytes smaller locally. A test strips it and requires the comparison to fail.

## Limits

- A call is forked at the ledger it was recorded at. Forking an arbitrary past ledger needs an archive source.
- A call whose live simulation fails, or touches archived entries that must be restored first, cannot be recorded: there is no footprint to fetch.
- Only entry types the engine executes against are loaded (account, trustline, contract data and code, config settings).
- Writes stay in the fork; there is no way yet to carry one call's state into the next.
