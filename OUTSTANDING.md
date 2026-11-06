# Outstanding work

Everything known to be unfinished, and what closes it. Written 2026-11-04, updated 2026-11-06.

Items are ordered by what blocks the most downstream work, not by effort. Each
says what it costs to leave alone, because a tracker that only lists tasks gets
read once. "Closes when" is a check anyone can run.

---

## 1. Blocking the product

### 1.1 Each protocol upgrade needs a new host

The engine embeds one `soroban-env-host` per protocol (29.0.2 and 30.0.0, renamed
in `Cargo.toml`, the same engine body instantiated once for each) and picks by
the network's protocol. This was necessary, not a preference: the cost model gains
entries at each protocol (`stellar-xdr` defines 86 `ContractCostType` variants
through protocol 29 and 95 in 30), so a host cannot meter a configuration from a
different protocol. Both hosts link into one `cdylib` (12 MB, 8-20 minute cold
build); the isolation spike alone proved less than that, because LTO dropped the
host code it did not call.

The evidence is now on both live networks. Testnet (30) is covered by 9 recorded
calls; **mainnet (29) is covered by 5 recorded calls to real contracts and real
state**, compared with Stellar RPC's own simulation (`@soroscope/testing`, see 3.1).

What is still open:

- **Every upgrade is a build-and-record chore.** Add `hostNN`/`simNN` to
  `Cargo.toml`, one `mod vNN` in `src/lib.rs`, record a fixture from that network.
  `protocol-drift.yml` fails when a network gets ahead of every embedded host.
  Drop the oldest host once neither network runs it, or the binary and the build
  keep growing. **Closes when:** the old host is removed after mainnet reaches 30,
  with the protocol-29 fixtures retired alongside it.

### 1.2 Published: `0.1.0` of seven packages, one step left

On 2026-11-06 the `Release` workflow published `@soroscope/core`, `invoke`, `cli`,
`ci`, `mcp`, `dev` and `differential` at `0.1.0`, after the five engine packages
(`@soroscope/dev-<platform>`) were published by `engine-binaries.yml`. Checked from
an empty directory with the real registry: `npm install @soroscope/cli` installs,
`soroscope probe --network mainnet` prints the table, and `@soroscope/dev` loads the
real prebuilt engine (protocols 29 and 30). How it was done, and the two blockers
found on the way (the CLI depended on two private packages; the engine link step
was never run), are in [`RELEASING.md`](./RELEASING.md).

**Closes when:** `v1` is tagged so `uses: soroscope/soroscope/packages/ci@v1`
resolves, and the Action is run once from a real workflow using that reference.
Each later release must publish the engine packages first (`link --verify` stops
the release otherwise).

### 1.3 The engine's prebuilt binaries: built, tested and published on all five platforms

`@soroscope/dev` needs a native engine. The pipeline exists:
`packages/dev/engine/platforms.json` is the single platform list;
`scripts/package-engine.mjs` packages one platform;
`.github/workflows/engine-binaries.yml` builds each natively, runs the engine and
fork tests against the binary being published, and publishes only on an explicit
`publish` input. The loader (`src/platform.ts`, `src/engine.ts`) finds a local
build first, then the installed platform package.

Two runs on all five platforms (2026-11-06, publish off). The first: linux-x64,
linux-arm64 and win32-x64 passed everything; darwin-arm64 and darwin-x64 built and
passed parity and every other engine test, but the watch-loop test failed. After the
fix below, **all five pass**: every engine test and every fork test, on the binary
that would be published.

The macOS failure was a real bug, not a runner quirk: `resolveProject` compared
the path it was given with the real path `cargo metadata` reports, and macOS's
`/tmp` and `/var` are symlinks into `/private`. It would have rejected any
contract crate reached through a symlink. Fixed with `realpath`, with a test that
builds a symlink explicitly so it fails on Linux too (verified failing on the
unfixed code), and confirmed passing on both macOS runners.

Not supported, by choice: musl (Alpine) and Windows on ARM. The loader says so
in its error rather than failing obscurely.

**Done 2026-11-06:** published at `0.1.0`. The engine packages carry `@soroscope/dev`'s
version, so **every version bump needs _Engine binaries_ run with `publish` on first**.
**Closes when:** a version bump has been released end to end by the routine in
`RELEASING.md` (nothing so far proves the second release).

---

## 2. `@soroscope/dev` fidelity gaps

What was open on 2026-11-04 and is not any more, each with its test:

- A contract's own `extend_ttl` is applied to the local ledger (`capabilities.test.ts`,
  with a real compiler: an unextended entry needs restoring once its default TTL
  passes, an extended one does not).
- The native asset contract exists at the live address (checked against the address
  recorded from testnet, and against mainnet's `CAS3J7GY…` in the fork recording).
- Several contracts in one session: `--with`, `session.addContract()`.
- The parity evidence is no longer one contract: mainnet token reads, a USDC
  transfer on two trustlines and a cross-contract DEX quote reproduce exactly.

What remains, known and documented:

- **Auth is recorded, not enforced**, as in RPC simulation. Intended.
- **Companions are not rebuilt on save**; only the contract under development is.
- **A new kind of call is not known to match until it has been recorded and
  compared.** The evidence is five mainnet calls, nine testnet calls and the
  fixture contract. It is not a proof for every contract. **Closes when:** a
  recorded set covers the contracts people actually run (a lending pool, an AMM
  swap with writes, a call with an invoker-auth subtree).
- **Extending a TTL runs the call twice.** `soroban-simulation`'s result carries no
  TTL changes, so the recording-mode result is read in a second pass on the same
  state and seed, before the writes land. It doubles the cost of a committed call
  (still milliseconds) and relies on the call being deterministic, which Soroban
  guarantees. **Closes when:** upstream exposes the TTL changes.

---

## 3. The two packages that were scaffolds

### 3.1 Fork-testing (`@soroscope/testing`): preview

`recordFork` asks Stellar RPC to simulate a call (which tells it what the call
touches), then reads exactly those ledger entries at the same ledger, retrying if
a ledger closed in between. `replayFork` runs the call on the engine against them
and compares with the network's own answer. **All five recorded mainnet calls
reproduce exactly**, including a USDC `transfer` over two trustlines and a
`router_get_amounts_out` that calls into a second contract.

It found a real bug on the way: `getLedgerEntries` returns a sponsored entry's
sponsorship in a separate `extXdr` field, the first version of the fork dropped
it, and every sponsored account and trustline was 44 bytes smaller locally, so
bytes read and the fee were wrong. A test strips `extXdr` and requires the
comparison to fail.

What is not built:

- **A past ledger.** A call is forked at the ledger it was recorded at. An archive
  source would be needed. **Closes when:** a call is forked at a pinned older ledger
  and matches a recorded answer from then.
- **A call whose live simulation fails, or touches archived entries,** cannot be
  recorded: there is no footprint. **Closes when:** the footprint comes from a
  local first pass instead of RPC's.
- **State is not carried from one forked call to the next.**
- **Only the entry types the engine executes against** are loaded (account,
  trustline, contract data and code, config settings).

### 3.2 Differential simulation (`@soroscope/differential`): preview

`differentialSimulate` sends one transaction to each provider directly and groups
them by the value they gave for every field. `soroscope simulate --compare` uses
it (exit 0 agree, 1 disagree, 3 none answered); checked live on mainnet.

**The five public mainnet providers agree** on all three recorded calls, including
a DEX quote that moves with every trade. So on this sample there is no real
disagreement to show, and none was fabricated: the grouping logic is tested on real
responses to different calls paired under provider names, and the tests say so.
**Closes when:** a real disagreement is recorded (a lagging or misconfigured
provider, a protocol skew during an upgrade) and added to the fixtures. The
original goal, "two real providers made to disagree on a recorded call", cannot be
met honestly until one does.

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
  was still at 29. Added a host for 30, re-recorded the fixture from live
  testnet, and kept the 29 host and its fixture so mainnet still works. Added
  the guard and the drift check so the next upgrade is an alert instead of a
  surprise.
- Rust crates are now watched: Dependabot (cargo, with protocol-major bumps
  excluded on purpose, since `protocol-drift.yml` is what announces those) and a
  `cargo audit` job in `audit.yml`. Run locally first: as first written it
  failed on day one with one real advisory and two unmaintained crates, which is
  why the exceptions above exist.
- The prebuilt-binary pipeline in 1.3.
- 2026-11-06: the engine gained the native asset contract, `extend_ttl`, live-entry loading,
  a real source account and companion contracts; fork-testing and differential simulation were
  built and checked against live mainnet; five-platform binary build run (3 of 5 green, macOS
  symlink bug found and fixed, then 5 of 5 green); the repository formatted so the
  Format check, red on every recent commit, passes.

Verified at that point: `pnpm lint`, `pnpm typecheck` (14 packages), `pnpm test`
(519 unit tests), `pnpm --filter @soroscope/dev test:engine` (60 tests) and `pnpm --filter @soroscope/testing test:engine` (9 tests) and
`pnpm check:fixtures` all clean.
