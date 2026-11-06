# @soroscope/dev

Run Soroban contracts inside your own process, the way `localhost` serves a web app and `nodemon` restarts a server: save the contract, call it a moment later. No network, no Docker, no faucet, no signing.

| Status | |
|---|---|
| Maturity | **preview**: the engine, the watch loop and spec-typed calls work and are tested; the `soroscope dev` prompt is new |
| Published | **yes**, `0.1.0` (2026-11-06), with prebuilt engines `@soroscope/dev-linux-x64-gnu`, `-linux-arm64-gnu`, `-darwin-x64`, `-darwin-arm64`, `-win32-x64-msvc`. Release steps: [`RELEASING.md`](../../RELEASING.md). The engine packages and their workflow ([`engine-binaries.yml`](../../.github/workflows/engine-binaries.yml)) and build and pass every engine test on Linux (x64, arm64), macOS (x64, arm64) and Windows; see [`OUTSTANDING.md`](../../OUTSTANDING.md) |
| Protocol | **29 and 30**: one `soroban-env-host` each, picked by the network's protocol. Testnet (30) and mainnet (29) both run; see [Protocols](#protocols) |

## `soroscope dev`

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
soroscope> move_funds from=me to=GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7 amount=300
← ()
  event   Moved { from: GAXK…3ZAJ, to: GAAZ…CWN7, amount: "300" }
  cost    602,368 instructions · 1,226,119 bytes memory · 4 entries (2 written) · fee 28,699 stroops · 1 auth
soroscope> move_funds from=me to=GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7 amount=999999
✗ Error #2 InsufficientFunds: The sender does not hold enough funds.
  cost    416,156 instructions · 1,221,792 bytes memory
● building (src/lib.rs changed)…
✓ swapped in place · CDUF…FKLZ · storage kept (build 2.8s)
  +version
soroscope> balance who=me
← "700"
```

- **Save to rebuild.** Changes to `.rs` files, `Cargo.toml` or `Cargo.lock` rebuild the contract (`stellar contract build`, or `cargo` with `--builder cargo`) and **swap the new code into the same contract**. Its ID and all its storage survive, so you never re-seed state. A compile error is shown and the last good build keeps running.
- **Call by name.** `fn name=value ...` with arguments typed from the contract's own spec (`amount=1000` becomes an `i128` where the spec says `i128`). `me` is the local account. `?fn ...` simulates without applying writes.
- **See what a call costs.** Every call prints its return value, its events named from the spec (`Moved { from, to, amount }`), CPU, memory, ledger entries, the resource fee and the authorizations it needs.
- **Commands:** `.fns` lists functions with their signatures, `.events` the declared events, `.advance <n>` closes ledgers (TTLs and timestamps move), `.gen [file]` writes TypeScript types, `.exit` quits.
- `--init '{"admin":"me"}'` passes constructor arguments to the first deploy.

The fee and cost settings of `--network` are read once at start; after that nothing touches the network.

## `soroscope gen`

```sh
soroscope gen target/wasm32v1-none/release/my_contract.wasm -o src/contract.ts
soroscope gen ./contracts/token --hooks          # build the crate first; add React hooks for its events
```

TypeScript parameter and return types, Zod schemas and event type guards for every function, event and user-defined type in the contract's spec. Generation is done by **Orbital's codegen** ([`@orbital-stellar/abi-registry`](https://www.npmjs.com/package/@orbital-stellar/abi-registry)), which Soroscope also uses to read the spec. The output imports `zod` and `@orbital-stellar/pulse-core`.

## As a library

```ts
import { DevSession, DevLoop, fetchNetworkConfig } from '@soroscope/dev';

const session = DevSession.create(await fetchNetworkConfig(rpc, 'Test SDF Network ; September 2015'));
const loop = new DevLoop({ projectDir: './contracts/counter', session, onEvent: console.log });
await loop.start();

const r = session.call('increment', { by: 5 });   // r.value, r.events, r.cpuInstructions, r.report
```

`LocalNetwork` is the layer underneath: deploy, invoke with base64 `ScVal`s, `swapWasm`, `advance`. Its `invoke` returns the same `SimulationReport` `@soroscope/core` decodes from RPC.

## How it works, and how it is checked

Contracts run inside `soroban-env-host`, the host stellar-core runs, through `soroban-simulation`, the code path Stellar RPC's `simulateTransaction` uses, against a ledger held in memory. The engine is a Rust crate in [`engine/`](./engine) loaded through N-API. A call takes about 3 ms.

- **The numbers are the network's.** Instructions, read and write bytes, footprint size and resource fee equal live testnet `simulateTransaction`, call for call. [`parity.test.ts`](./tests/engine/parity.test.ts) checks this against [recorded live responses](./tests/fixtures/engine-parity.json) for the exact WASM the network ran.
- **The loop is tested with a real compiler.** [`loop.test.ts`](./tests/engine/loop.test.ts) builds a copy of the fixture contract, edits it on disk, and checks the rebuild, the swap, the storage that survived, and recovery from a compile error.

## Protocols

A `soroban-env-host` runs only the protocol it was released for, and meters calls with a cost model that gains entries at each protocol (86 cost types at protocol 29, 95 at 30). So the engine links one host per protocol and picks by the network's:

| Network protocol | Host | Evidence |
|---|---|---|
| 30 (testnet) | `soroban-env-host` 30.0.0 | costs equal a live `simulateTransaction` on 9 recorded calls (testnet, ledger 5561299) |
| 29 (mainnet) | `soroban-env-host` 29.0.2 | costs equal a live **mainnet** `simulateTransaction` on 5 recorded calls to real contracts and state (a USDC transfer, a cross-contract Soroswap quote; see [`@soroscope/testing`](../testing)), and on 9 calls recorded from testnet while it ran 29 |
| anything else | none | refused with `UnsupportedProtocolError`, which names the protocols this build supports |

Refusing is deliberate: padding or guessing would give numbers that look right and are not the network's. A configuration labelled with the wrong protocol is refused too (`cost model mismatch`). `supportedProtocols()` lists what a build embeds, and `.github/workflows/protocol-drift.yml` fails when a live network gets ahead of every embedded host. To add the next protocol, see [`OUTSTANDING.md`](../../OUTSTANDING.md) 1.1.

## Companion contracts

A contract that calls another can be developed together with it:

```sh
soroscope dev ./my-contract --with ./vault.wasm --with ./oracle.wasm
✓ vault: CBX2…   (call as vault.fn)
soroscope> vault.deposit amount=100        # a companion
soroscope> ?swap amount=100                # the contract under development, which calls vault
```

Companions are deployed once and are not rebuilt on save. In code: `session.addContract(name, wasm, ctorArgs?)` and `session.call(fn, args, { contract: name })`.

## The native asset, and TTLs

The native (XLM) asset contract exists in every local ledger, at the same address it has on the live network (it depends only on the network passphrase), so `CAS3J7GY…` is there on mainnet's ledger and `CDLZFC3S…` on testnet's. `balance`, `transfer` and the rest work against the local account.

A contract's own `extend_ttl` is applied to the local ledger, so an entry it extends outlives its default TTL, and one it does not extend needs restoring once that passes, which shows in the call's `archivedEntries` as it does in Stellar RPC.

## Real state

`LocalNetwork.loadEntries()` puts live ledger entries into the local ledger (keep each entry's `extXdr`: a sponsored account or trustline is 44 bytes larger, which changes the bytes read and the fee). [`@soroscope/testing`](../testing) builds on it to run calls against recorded live mainnet state.

## Limits

- Auth is **recorded, not enforced**, as in RPC simulation: every `require_auth` passes and is reported.
- Companion contracts are not rebuilt on save, only the contract under development.
- A call is checked against the network on the contracts and state recorded in [`@soroscope/testing`](../testing) and on the fixture contract. A new kind of call is not known to match until it has been recorded and compared.

## Building

```sh
pnpm --filter @soroscope/dev build:engine   # cargo build --release (needs Rust)
pnpm --filter @soroscope/dev test:engine    # engine, session, parity and watch-loop tests
```

`SOROSCOPE_ENGINE_PATH` points at a binary built elsewhere. To re-record the parity fixture (needs the `stellar` CLI, Rust and network access; deploys to testnet with a throwaway friendbot key): `node packages/test-utils/scripts/record-engine-parity.mjs`.

## Next

1. Fork a past ledger, and write state back to a fork.
