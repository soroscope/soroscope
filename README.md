# Soroscope

[![CI](https://github.com/soroscope/soroscope/actions/workflows/ci.yml/badge.svg)](https://github.com/soroscope/soroscope/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@soroscope/cli?label=npm)](https://www.npmjs.com/package/@soroscope/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Developer tooling for Stellar and Soroban, built on one idea: **know what each RPC provider can really do before you rely on it.**

Providers differ in ways their health endpoint does not tell you. Here is a real run against Stellar mainnet:

```
PROVIDER                                STATUS    P50    P95     LAG  WINDOW  LEDGERS REACH  PROTO
soroban-rpc.mainnet.stellar.gateway.fm  healthy   495ms  6102ms  3    7.0d    -              29
mainnet.sorobanrpc.com                  healthy   508ms  6169ms  2    7.0d    18d*?          29
archive-rpc.lightsail.network           degraded  258ms  8211ms  0    0.0d    730d*          29
soroban-rpc.creit.tech                  degraded  286ms  8150ms  0    1.0d    -              29
rpc.lightsail.network                   degraded  740ms  740ms   0    7.0d    29d*?          29

* getLedgers reaches beyond the advertised window (getTransactions/getEvents do not).
? inconsistent: the provider answered the same lookup differently on retry.
```

Look at the second and fifth rows: `getLedgers` answers far beyond the advertised 7-day window, but **not consistently** (the `?`). The first provider's reach could not be measured at all. A router that ranks by latency alone would treat these five as interchangeable. Soroscope's does not.

Everything below is built on that knowledge.

## Install

```sh
npm install --global @soroscope/cli
soroscope probe --network mainnet
```

Or `npm install @soroscope/core` for the library, `npx -y @soroscope/mcp` for the agent server, and `uses: soroscope/soroscope/packages/ci@v1` for the GitHub Action. `soroscope dev` installs with the CLI, along with the prebuilt engine for Linux (x64, arm64), macOS (x64, arm64) or Windows x64; it also needs Rust to compile your contract. **Documentation: <https://soroscope.vercel.app/docs/getting-started/introduction>.** Its source is [`packages/demo/content`](./packages/demo/content) (a Next.js site) and, rendered for GitHub, [`docs/`](./docs).

## Packages

| Package                                              | What it does                                                                                                                                                                                                                                                                               | Status                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| [`@soroscope/core`](./packages/core)                 | Retention-aware RPC router and provider registry; provider probe; XDR decoders; contract specs; decoded simulation reports. Zero runtime dependencies.                                                                                                                                     | implemented, tested live                      |
| [`@soroscope/cli`](./packages/cli)                   | `soroscope probe`, `route-explain`, `decode`, `explain`, `spec`, `simulate`, `check`.                                                                                                                                                                                                      | implemented, tested live                      |
| [`@soroscope/ci`](./packages/ci)                     | GitHub Action: fail a pull request when a Soroban call gets more expensive.                                                                                                                                                                                                                | implemented, tested live                      |
| [`@soroscope/mcp`](./packages/mcp)                   | Read-only MCP server so AI agents can check RPC health, decode XDR and simulate calls.                                                                                                                                                                                                     | implemented, tested live                      |
| [`@soroscope/invoke`](./packages/invoke)             | Build contract calls from a contract's spec; deploy and call a WASM build on testnet.                                                                                                                                                                                                      | implemented, tested live                      |
| `@soroscope/gql`                                     | GraphQL gateway generated from a contract spec.                                                                                                                                                                                                                                            | frozen                                        |
| [`@soroscope/dev`](./packages/dev)                   | `soroscope dev`: run a contract in-process inside `soroban-env-host`, rebuild and hot-swap it on save with storage kept, call it by name. Costs match live testnet exactly (testnet on protocol 30, mainnet on 29: one host each). `soroscope gen` for TypeScript types (Orbital codegen). | preview, tested; on npm with prebuilt engines |
| [`@soroscope/testing`](./packages/testing)           | Run calls against recorded live mainnet state on the engine, and check the engine against the network.                                                                                                                                                                                     | preview, tested; not published yet            |
| `@soroscope/inspect`                                 | SAC / SEP-41 token inspector and `stellar.toml` linter.                                                                                                                                                                                                                                    | frozen                                        |
| [`@soroscope/differential`](./packages/differential) | Simulate on several providers and report where they disagree (`soroscope simulate --compare`).                                                                                                                                                                                             | preview, tested; on npm, used by the CLI      |
| [`soroscope-vscode`](./packages/vscode)              | Decoded events, auth trees and footprints in the editor.                                                                                                                                                                                                                                   | frozen                                        |

A **preview** package works and is tested, and its README lists what it does not do yet; its API may change. A **frozen** package is a scaffold: it builds and exports its types, has no implementation, and is not planned. See the [roadmap](#roadmap).

## What you can do with it

**Choose and monitor providers.**

```sh
soroscope probe --network mainnet                 # latency, lag, retention, real getLedgers reach
soroscope probe --network mainnet --serve 9464    # Prometheus /metrics
soroscope route-explain getEvents --network mainnet --start-ledger 64000000
```

**Route calls so they land somewhere that can serve them.**

```ts
import { SoroscopeRouter, publicProviderUrls } from '@soroscope/core';

const router = await SoroscopeRouter.create({ providers: publicProviderUrls('mainnet') });
const events = await router.call('getEvents', {
  startLedger,
  filters: [{ type: 'contract' }],
  pagination: { limit: 20 },
});
```

If no provider retains the ledger you asked for, you get `NoEligibleProviderError` listing why each was ruled out, not a refusal from the provider.

**Understand a failed call.**

```sh
soroscope simulate --contract CC... --fn transfer --args '{"from":"G...","to":"G...","amount":"1000"}'
# Simulation failed: Contract CC... raised Error(Contract, #2) (Error::InsufficientFunds).
```

The error gets the name the contract's own spec gives it.

**Stop expensive regressions before they ship.**

```yaml
- uses: soroscope/soroscope/packages/ci@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

It simulates the calls in `soroscope.config.json`, compares instructions, ledger reads and writes, fee and the ledger footprint with a committed baseline, and comments on the pull request. See [CI resource checks](./packages/demo/content/guides/ci-resource-checks.md).

**Let an agent look, not touch.**

```json
{ "mcpServers": { "soroscope": { "command": "npx", "args": ["-y", "@soroscope/mcp"] } } }
```

## What it deliberately does not do

Nothing in the router, CLI or MCP server signs or submits a transaction, and the MCP server refuses any input containing a secret key. The only signing is in `@soroscope/invoke`, used by the CI check to deploy your build to **testnet** with a throwaway key funded by friendbot.

## How it is tested

**Nothing is mocked.** Not the network, not XDR, not time-of-day behaviour of providers.

- Decoders are tested against **real XDR captured from the live network**, compared with the output of the official `stellar xdr decode` for the same bytes. Hundreds of real diagnostic events, auth entries, footprints and ledger entries. [`COVERAGE.md`](./packages/core/tests/fixtures/COVERAGE.md) lists which union arms the corpus has, and which it does not.
- Contract specs are parsed from real compiled contracts and compared entry for entry with `stellar contract info`.
- The router, probe, CLI, Action and MCP server are tested against **live testnet RPC providers**, including real failures (DNS, refused connection, timeout, HTTP 404/403, out-of-range ledgers).
- A purpose-built [fixture contract](./packages/test-utils/fixture-contract) is deployed to testnet. It has real contract errors, auth, events, all three storage durabilities, and cost knobs, so a CI regression test compares `work(10)` with `work(5000)`, not an edited number.
- The CI check runs the whole Mode-B path for real: deploys the WASM twice with different throwaway keys and requires the two measurements to be equal.
- The local engine is checked against the network: instructions, bytes read and written, footprint and resource fee equal a live `simulateTransaction`, call for call, on 9 recorded testnet calls and 5 recorded **mainnet** calls (including a USDC transfer and a cross-contract DEX quote). The watch loop is tested with a real compiler. `pnpm --filter @soroscope/dev test:engine` and `pnpm --filter @soroscope/testing test:engine` run these.
- The published Action has been run end to end from `@v1`: it deployed the fixture contract to testnet twice with different throwaway keys and the second run matched the first baseline.
- A lint rule **bans** `vi.mock`, `vi.fn`, `vi.spyOn` and friends in tests. Fixtures must carry a provenance block saying how they were recorded.

`pnpm test` runs the unit suite (real recorded fixtures, no network). `pnpm test:integration` runs the live suites. The live suites depend on public infrastructure, so they run in their own workflow rather than gating merges.

## Development

**Prerequisites:** Node.js 22+ (pinned in `.nvmrc`), pnpm 10, and for the fixture tooling the [`stellar` CLI](https://developers.stellar.org/docs/tools/cli) and a Rust toolchain with the `wasm32v1-none` target.

```sh
pnpm install
pnpm build
pnpm test                 # unit tests
pnpm test:integration     # live testnet
pnpm lint
pnpm check:fixtures       # every fixture has provenance
pnpm --filter @soroscope/dev build:engine   # the native engine (needs Rust; 8-20 minutes cold)
pnpm --filter @soroscope/dev test:engine
```

Re-record fixtures (needs network and the `stellar` CLI; uses throwaway keys in a temp directory, never your own):

```sh
node packages/test-utils/scripts/record-rpc.mjs
node packages/test-utils/scripts/record-soroban.mjs
node packages/test-utils/scripts/coverage-matrix.mjs
# after a testnet reset, redeploy the fixture contract:
(cd packages/test-utils/fixture-contract && stellar contract build)
node packages/test-utils/scripts/deploy-fixture-contract.mjs
```

## Repository layout

```
soroscope/
├── packages/
│   ├── core/          @soroscope/core
│   ├── cli/           @soroscope/cli
│   ├── ci/            @soroscope/ci        (the GitHub Action: action.yml + action/index.cjs)
│   ├── mcp/           @soroscope/mcp
│   ├── invoke/        @soroscope/invoke
│   ├── test-utils/    fixture recorders and the fixture contract (private)
│   ├── dev/           @soroscope/dev       (in-process engine: dev/engine is a Rust crate; prebuilt per platform)
│   ├── testing differential   preview
│   ├── gql inspect vscode     frozen
│   └── demo/          documentation site (Next.js)
├── docs/              generated from packages/demo/content
└── .github/workflows/ CI, live integration, Action bundle check, release
```

## Roadmap

Built, in order of what was judged most valuable (see the research behind it in `reports/`):

1. Retention-aware routing and provider health monitoring
2. CI fee and resource regression checks
3. MCP and agent interface for decode and simulate
4. **`soroscope dev`** (`@soroscope/dev`, preview, on npm): save a contract and call it a moment later, without a network. Contracts run in-process inside `soroban-env-host`; each save rebuilds and hot-swaps the code with storage kept; functions are called by name with arguments typed from the spec, and every call shows its events and cost, which equal the network's own simulation on the calls checked. `soroscope gen` writes TypeScript types from the spec using Orbital's codegen.
5. **Provider comparison** (`soroscope simulate --compare`, preview, on npm).
6. **Fork-testing** (`@soroscope/testing`, preview, not published): run calls against recorded live mainnet state, offline.

Next, in order (the full list, with what closes each, is in [`OUTSTANDING.md`](./OUTSTANDING.md)):

- Record more kinds of calls (a lending pool, an AMM swap that writes state, nested authorization) and compare them with the network, so the engine's evidence covers what people run.
- **Forking a past ledger** and carrying state between forked calls; then publish `@soroscope/testing`.
- A real provider disagreement for `--compare` to show, when one turns up.

Frozen, not planned: the GraphQL gateway (`@soroscope/gql`), the token and `stellar.toml` inspector (`@soroscope/inspect`) and the VS Code extension. Their READMEs say why.

Deliberately avoided: general indexers and explorers, static analysis and fuzzing, WASM step-through debuggers, and source verification while its standards are unsettled. Other projects already serve those.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). In short: no mocks, record fixtures instead of writing them, and say what you could not verify.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/soroscope/soroscope/issues).

## Migrating from `stellar-lens`

Soroscope replaces the `stellar-lens` package. See [MIGRATION.md](./MIGRATION.md).

## License

[MIT](./LICENSE)
