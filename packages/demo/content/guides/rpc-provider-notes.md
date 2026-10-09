---
title: What RPC providers really do
description: Measured behaviour of public Stellar RPC providers that the docs and health endpoints do not tell you, and how Soroscope accounts for it.
---

These are things observed against live providers (October 2026) while building Soroscope. They are why the router checks instead of assuming. Providers change, so treat this as a snapshot and run `soroscope probe` for the current picture.

## Retention differs a lot

`getHealth` reports `oldestLedger` and `ledgerRetentionWindow`. Public mainnet providers ranged from about **1 day** to **7 days**, and one advertised only a window of **64 ledgers**. A request for events older than a provider's window is refused with a JSON-RPC error (code `-32600`, HTTP 200), not an HTTP error:

```
start ledger (60000000) must be between the oldest ledger: 64730495 and the latest ledger: 64851454 for this rpc instance
```

The message states the valid range, and the router reads it to learn each provider's bounds.

## `getLedgers` can reach much further than the window

`getTransactions` and `getEvents` stay inside the advertised window. `getLedgers` does not: some providers serve it from a data lake. One provider that advertised a 64-ledger window answered `getLedgers` for a ledger roughly 270 days old. So the router tracks `getLedgers` reach **separately** from the advertised window.

## The same endpoint can answer differently

`mainnet.sorobanrpc.com` served a 270-day-old ledger once and refused it minutes later. A provider behind a load balancer over mixed backends can do that. So reach is treated as **evidence with an expiry** (ten minutes), the probe asks a refusal twice, and reports `consistent: false` when the two answers disagree.

## `getNetwork` does not always include `friendbotUrl`

The SDF endpoint does; at least one other provider does not. Code that reads the friendbot URL from `getNetwork` works or fails depending on which provider the router happened to pick. `@soroscope/invoke` takes it from the network passphrase instead.

## Some providers need an API key

`rpc.ankr.com/stellar_testnet` answers HTTP 403 without a key. The router classifies 401 and 403 as `auth`, marks the provider misconfigured, and stops sending it traffic.

## Simulation needs no real account

`simulateTransaction` accepts a transaction whose source account does not exist and whose sequence number is `0`. That is why `soroscope simulate` and the CI check need no funded account.

## Simulation reports no CPU/memory `cost`

Older SDK types describe a `cost: { cpuInsns, memBytes }` object. Current RPC responses do not include it. CPU use is the `instructions` figure inside `transactionData.resources`; there is no memory figure. Soroscope's CI check therefore gates on instructions, disk reads, writes, fee and footprint, not memory.

## A compiler can erase your benchmark

A "burn CPU" loop that just sums a sequence was compiled into a closed-form expression and cost the same for any input. Cost knobs in test contracts need a loop-carried dependency the optimiser cannot collapse.
