# Outstanding work

Everything known to be unfinished, and what closes it. Written 2026-11-04.

Items are ordered by what blocks the most downstream work, not by effort. Each
says what it costs to leave alone, because a tracker that only lists tasks gets
read once. "Closes when" is a check anyone can run.

---

## 1. Blocking the product

### 1.1 `@soroscope/dev` can run one protocol, and the two live networks are on different ones

The engine embeds one `soroban-env-host`, now 30.0.0. Checked 2026-11-04 against
the live networks:

| Network | Protocol | `soroscope dev` |
|---|---|---|
| testnet | 30 | runs; costs equal live `simulateTransaction` on all 9 recorded calls (ledger 5561299) |
| mainnet | 29 | refused with `UnsupportedProtocolError` |

One host cannot serve both, and this is not a version-pin oversight. The cost
model gains entries at each protocol: `stellar-xdr` defines 86 `ContractCostType`
variants through protocol 29 and 95 in 30. A protocol-29 network's recorded
configuration therefore has nine fewer entries than the v30 host needs to build
its budget. Before the guard, that surfaced as `Error(Context, InternalError)` on
the first WASM upload, which says nothing. The first v30 build against the
protocol-29 fixture failed 15 of 24 engine tests this way.

Padding the missing nine entries would make mainnet "work" with numbers that look
right and are not the network's, which is the one thing this package promises
not to do. So it refuses.

**Cost of leaving it alone:** `--network mainnet` is unusable until mainnet
upgrades to protocol 30. When it does, the problem is the other way round for
anyone still on a protocol-29 engine. Every protocol upgrade reopens this.

**Closes when:** one binary runs both protocols (two hosts side by side, chosen
by the network's protocol: `soroban-env-host` 29.0.2 and 30.0.0 renamed in
`Cargo.toml`, the engine body instantiated once per host), with a parity
fixture recorded from each network, both passing in CI. Unverified: that two
`soroban-env-host` majors link into one `cdylib` without clashing. Try that
first, in isolation, before building on it. If they do not link, the fallback is
one engine package per protocol and a loader that picks by network.

**What exists now:** `UnsupportedProtocolError` (network ahead of the host, or
behind its cost model), `hostProtocolVersion()`, and
`.github/workflows/protocol-drift.yml`, which fails twice a week when a live
network is ahead of the embedded host and reports when one is behind.

### 1.2 Nothing is published

`registry.npmjs.org` returns 404 for every `@soroscope/*` package, and the
repository has no tags and no releases. The README shows
`npx -y @soroscope/mcp` and `uses: soroscope/soroscope/packages/ci@v1`; neither
resolves.

**Cost of leaving it alone:** nobody outside this repository can use any of it.
`probe`, the router, the CI action and the MCP server are finished and tested
live; they are just not installable.

**Closes when:** the `NPM_TOKEN` repository secret is set (publishing is the
owner's call, not something a commit can do), a changeset covers core, invoke,
cli, ci and mcp, the `Release` workflow publishes them, and `v1` is tagged so
the Action reference resolves. Then, from an empty directory:
`npx @soroscope/cli probe --network mainnet` prints a table.

### 1.3 The engine's prebuilt binaries have only been built on linux-x64

`@soroscope/dev` needs a native engine. The pipeline exists:
`packages/dev/engine/platforms.json` is the single platform list;
`scripts/package-engine.mjs` packages one platform;
`.github/workflows/engine-binaries.yml` builds each natively, runs the engine
tests against the binary being published, and publishes only on an explicit
`publish` input. The loader (`src/platform.ts`, `src/engine.ts`) finds a local
build first, then the installed platform package.

Verified: the packaged linux-x64 `.node` loads and reports its protocol; the
platform table and the workflow's matrix come from one file, with a unit test.
**Not verified:** any other platform, and the workflow itself, which has never
run. Windows is the likeliest to surprise (`process.dlopen` of a cdylib, MSVC).

Not supported, by choice: musl (Alpine) and Windows on ARM. The loader says so
in its error rather than failing obscurely.

**Closes when:** the workflow runs green on all five platforms, the packages are
published, and `@soroscope/dev` is flipped from `private` with
`package-engine.mjs link` run before its publish. A smoke test on each OS then
runs `soroscope dev` against the fixture contract.

---

## 2. `@soroscope/dev` fidelity gaps

Known, documented in the package README, and each one makes a local result differ
from what the network would do.

- **A contract's own `extend_ttl` is not applied to the local ledger.**
  `soroban-simulation`'s `InvokeHostFunctionSimulationResult` carries modified
  entries but no TTL changes, so applying them means going below the simulation
  API to the host's recording-mode result, which is the path whose numbers are
  checked against the network. Do not do this at the cost of the parity.
  **Closes when:** done without changing any recorded cost, or kept as a stated
  limit.
- **Auth is recorded, not enforced**, as in RPC simulation. Intended.
- **No native asset contract.** A contract that calls the XLM Stellar Asset
  Contract fails locally. **Closes when:** the SAC is instantiated in the empty
  ledger, or fork-testing (3.1) supplies the real one.
- **The parity evidence is one contract.** Nine calls on the fixture contract
  (`work`, `touch`, `emit`, `put`, `put_temp`, `balance`, `version`,
  `fail_with`). That proves the cost path; it does not prove token transfers,
  cross-contract calls or archived-entry restores. **Closes when:** a recorded
  call set covers a token contract and a two-contract call.
- **One contract per session**, so a contract that calls another cannot be run.

---

## 3. Packages that are not built

### 3.1 Fork-testing (`@soroscope/testing`)

A scaffold. The intent is to load live mainnet or testnet entries into the
engine and test against real state.

Design, **not yet verified**: the host reads state through a synchronous
`SnapshotSource::get`, so an async RPC call cannot sit inside it. The workable
shape is two-pass: simulate against RPC to get the footprint, fetch those keys,
load them with a new `Engine::load_entries`, and run locally. Needs the engine
to accept entries, which it does not yet (it seeds configuration only). Depends
on 1.1 for the same reason as everything else: it must match the network's
protocol.

**Closes when:** a test forks a real testnet contract at a pinned ledger and
its local result equals the recorded live one.

### 3.2 Differential simulation (`@soroscope/differential`)

A scaffold. Simulate one call on several providers and report where they
disagree. Independent of the engine; builds on `@soroscope/core`'s router.
**Closes when:** two real providers are made to disagree on a recorded call,
and the report names the field.

Frozen, not planned: `gql`, `inspect`, the VS Code extension. Their READMEs say
why.

---

## 4. CI and supply chain

- **Three RustSec exceptions, all upstream.** `cargo audit` reports
  `RUSTSEC-2026-0387` (`crypto-bigint` 0.5.5, timing variability) and the
  unmaintained proc-macros `paste` and `derivative`, all pulled in by
  `soroban-env-host` / `soroban-sdk`. They are listed with reasons in
  `.cargo/audit.toml`; the first is not reachable because the engine never
  handles a secret key. **Closes when:** `soroban-env-host` moves its
  elliptic-curve stack to `crypto-bigint` >= 0.7.6, and the exceptions are
  deleted. Re-read them at every host bump.
- **Actions are pinned to release tags, not commit SHAs.** A tag can be moved.
  `scorecard.yml` will report it. **Closes when:** pinned by SHA, with
  Dependabot's `github-actions` entry keeping them current.
- **25 workflows.** Several are real gates (`ci`, `check`, `coverage`,
  `integration`, `codeql`, `dependency-review`); others are housekeeping. A
  workflow nothing depends on is a standing cost. **Closes when:** each one
  either has a reason in its header or is deleted.
- **The live integration suites do not gate merges.** They depend on public
  infrastructure, so they run on their own. A broken live path is found on the
  next run, not on the pull request.

---

## Done in the pass that produced this file

Context for whoever picks this up; not a to-do list.

- `@soroscope/dev` landed: in-process `soroban-env-host`, hot swap, spec-typed
  calls, the `soroscope dev` prompt. 35 engine tests, including parity with a
  live `simulateTransaction` and a real compiler in the watch loop.
- Found that testnet was on protocol 30 when the parity fixture, recorded four days earlier,
  was still at 29. Bumped the host to 30.0.0, re-recorded the fixture from
  live testnet, and added the guard and the drift check so the next upgrade is
  an alert instead of a surprise.
- Rust crates are now watched: Dependabot (cargo, with protocol-major bumps
  excluded on purpose, since `protocol-drift.yml` is what announces those) and a
  `cargo audit` job in `audit.yml`. Run locally first: as first written it
  failed on day one with one real advisory and two unmaintained crates, which is
  why the exceptions above exist.
- The prebuilt-binary pipeline in 1.3.

Verified at that point: `pnpm lint`, `pnpm typecheck` (14 packages), `pnpm test`
(505 unit tests), `pnpm --filter @soroscope/dev test:engine` (35 tests) and
`pnpm check:fixtures` all clean.
