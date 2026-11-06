---
title: Develop a contract locally
description: Run a Soroban contract in your own process, rebuild and hot-swap it on every save, and call it from a prompt with the network's real costs.
---

`soroscope dev` runs your contract inside `soroban-env-host`, the same host stellar-core runs, against a ledger held in memory. Save the contract and call it a moment later: no network, no Docker, no faucet, no signing.

> **Status: preview.** The engine, the watch loop and spec-typed calls work and are tested. `soroscope dev` ships with `@soroscope/cli` (the prebuilt engine installs with it; see [Installation](/docs/getting-started/installation)). It needs the `stellar` CLI or `cargo`, plus Rust, to compile your contract.

## Start

```sh
cd my-contract            # the crate with the contract's Cargo.toml
soroscope dev             # or: soroscope dev path/to/crate --network mainnet
```

```
reading testnet fee and cost settings…
● building (start)…
✓ deployed CDUFFSMD7XTNVR3VT3JBUYAWJLBI75BQO3TG75J7B4RIDUGVBHWSFKLZ (build 2.3s)
soroscope> mint to=me amount=1000
← ()
  cost    488,796 instructions · 1,221,790 bytes memory · 3 entries (1 written) · fee 26,299 stroops · 1 auth
soroscope> move_funds from=me to=GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7 amount=999999
✗ Error #2 InsufficientFunds: The sender does not hold enough funds.
  cost    416,156 instructions · 1,221,792 bytes memory
● building (src/lib.rs changed)…
✓ swapped in place · CDUF…FKLZ · storage kept (build 2.8s)
soroscope> balance who=me
← "700"
```

The fee and cost settings of `--network` are read once at start. After that nothing touches the network.

## What happens on save

Changes to `.rs` files, `Cargo.toml` or `Cargo.lock` rebuild the contract and **swap the new code into the same contract**. Its ID and all its storage survive, so you never re-seed state. A compile error is shown and the last good build keeps running.

## Call a function

`fn name=value ...`. Arguments are typed from the contract's own spec: `amount=1000` becomes an `i128` where the spec says `i128`. `me` is the local account. Start a line with `?` (`?mint to=me amount=5`) to simulate without applying writes.

Every call prints its return value, its events named from the spec (`Moved { from, to, amount }`), CPU, memory, ledger entries, the resource fee and the authorizations it needs.

| Command | |
|---|---|
| `.fns` | Functions with their signatures. |
| `.events` | The events the contract declares. |
| `.advance <n>` | Close `n` ledgers. TTLs and timestamps move. |
| `.gen [file]` | Write TypeScript types for the contract. |
| `.exit` | Quit. |

## Options

| Option | |
|---|---|
| `--network testnet\|mainnet` | Whose fee and cost settings to use. Also picks the protocol (see below). |
| `--builder stellar\|cargo` | How to compile. `stellar` is the default when installed. |
| `--init '{"admin":"me"}'` | Named constructor arguments for the first deploy. |
| `--with <wasm>` | Deploy another contract beside yours, called as `name.fn`. Repeatable. |

## Contracts that call other contracts

```sh
soroscope dev ./my-contract --with ./vault.wasm --with ./oracle.wasm
```

```
✓ vault: CBX2…   (call as vault.fn)
soroscope> vault.deposit amount=100        # a companion
soroscope> ?swap amount=100                # your contract, which calls vault
```

Companions are deployed once and are **not** rebuilt on save. Only the contract under development is.

## The native asset and TTLs

The native (XLM) asset contract exists in every local ledger, at the address it has on the live network, so `balance` and `transfer` work against the local account.

A contract's own `extend_ttl` is applied to the local ledger. An entry it extends outlives its default TTL; one it does not extend needs restoring once that passes, and shows up in the call's `archivedEntries`, as it does in Stellar RPC.

## Use it as a library

```ts
import { DevSession, DevLoop, fetchNetworkConfig } from '@soroscope/dev'

const session = DevSession.create(await fetchNetworkConfig(rpc, 'Test SDF Network ; September 2015'))
const loop = new DevLoop({ projectDir: './contracts/counter', session, onEvent: console.log })
await loop.start()

const r = session.call('increment', { by: 5 }) // r.value, r.events, r.cpuInstructions, r.report
```

`r.report` is the same `SimulationReport` `@soroscope/core` decodes from RPC.

## Are the numbers the network's?

For the calls checked, yes, exactly. Instructions, read and write bytes, footprint size and resource fee equal a live `simulateTransaction`, call for call. See [Test against live state](/docs/guides/fork-testing) for the mainnet evidence.

| Network protocol | Host | Checked against |
|---|---|---|
| 30 (testnet) | `soroban-env-host` 30.0.0 | 9 recorded live testnet calls |
| 29 (mainnet) | `soroban-env-host` 29.0.2 | 5 recorded live **mainnet** calls |
| anything else | none | refused with `UnsupportedProtocolError` |

A host only runs the protocol it was released for, and its cost model gains entries at each protocol, so the engine embeds one host per protocol and picks by the network's. Refusing an unknown protocol is deliberate: guessing would give numbers that look right and are not.

A new kind of call is not known to match until it has been recorded and compared.

## Limits

- Authorization is **recorded, not enforced**, as in RPC simulation: every `require_auth` passes and is reported.
- Companion contracts are not rebuilt on save.
- Extending a TTL runs the call twice, because the simulation result carries no TTL changes. It costs milliseconds.

## When something goes wrong

### `UnsupportedProtocolError`

**What it looks like:** the network you chose runs a protocol this build has no host for, and the error names the protocols it does support.

**Why:** the network was upgraded after this build. A host cannot meter a protocol it was not released for.

**What to do:** update `@soroscope/dev`, or use `--network` with a network on a supported protocol. Maintainers: `protocol-drift.yml` reports this before users hit it.

### `EngineNotBuiltError`

**What it looks like:** `soroscope dev` stops with a usage error saying the native engine is missing.

**Why:** the engine is a Rust library, and there is no prebuilt binary for your platform yet, or none was installed.

**What to do:** from a source checkout, `pnpm --filter @soroscope/dev build:engine` (needs Rust). Set `SOROSCOPE_ENGINE_PATH` to use a binary built elsewhere. Prebuilt binaries exist for Linux (x64, arm64), macOS (x64, arm64) and Windows x64; musl (Alpine) and Windows on ARM are not supported.

### `cost model mismatch`

**What it looks like:** the engine refuses a configuration at startup.

**Why:** the cost settings you passed were labelled with a protocol they do not belong to.

**What to do:** let `soroscope dev` read the settings from the network itself, as it does by default.

### A compile error after saving

The last good build keeps running and the compiler output is shown. Fix the error and save again; nothing else needs restarting.
