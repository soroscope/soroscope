# Soroscope

[![CI](https://github.com/soroscope/soroscope/actions/workflows/ci.yml/badge.svg)](https://github.com/soroscope/soroscope/actions/workflows/ci.yml)
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

## Packages

| Package | What it does | Status |
|---|---|---|
| [`@soroscope/core`](./packages/core) | Retention-aware RPC router and provider registry; provider probe; XDR decoders; contract specs; decoded simulation reports. Zero runtime dependencies. | implemented, tested live |
| [`@soroscope/cli`](./packages/cli) | `soroscope probe`, `route-explain`, `decode`, `explain`, `spec`, `simulate`, `check`. | implemented, tested live |
| [`@soroscope/ci`](./packages/ci) | GitHub Action: fail a pull request when a Soroban call gets more expensive. | implemented, tested live |
| [`@soroscope/mcp`](./packages/mcp) | Read-only MCP server so AI agents can check RPC health, decode XDR and simulate calls. | implemented, tested live |
| [`@soroscope/invoke`](./packages/invoke) | Build contract calls from a contract's spec; deploy and call a WASM build on testnet. | implemented, tested live |
| `@soroscope/gql` | GraphQL gateway generated from a contract spec. | scaffold |
| `@soroscope/dev` | Hot reload for contracts on a local network. | scaffold |
| `@soroscope/testing` | Fork-testing harness for contracts. | scaffold |
| `@soroscope/inspect` | SAC / SEP-41 token inspector and `stellar.toml` linter. | scaffold |
| `@soroscope/differential` | Simulate on several providers and report where they disagree. | scaffold |
| [`soroscope-vscode`](./packages/vscode) | Decoded events, auth trees and footprints in the editor. | scaffold |

A **scaffold** builds and exports its types and says so in its README. It has no implementation. See the [roadmap](#roadmap).

## What you can do with it

**Choose and monitor providers.**

```sh
soroscope probe --network mainnet                 # latency, lag, retention, real getLedgers reach
soroscope probe --network mainnet --serve 9464    # Prometheus /metrics
soroscope route-explain getEvents --network mainnet --start-ledger 64000000
```

**Route calls so they land somewhere that can serve them.**

```ts
import { SoroscopeRouter, publicProviderUrls } from '@soroscope/core'

const router = await SoroscopeRouter.create({ providers: publicProviderUrls('mainnet') })
const events = await router.call('getEvents', { startLedger, filters: [{ type: 'contract' }], pagination: { limit: 20 } })
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
│   ├── gql dev testing inspect differential vscode   scaffolds
│   └── demo/          documentation site (Next.js)
├── docs/              generated from packages/demo/content
└── .github/workflows/ CI, live integration, Action bundle check, release
```

## Roadmap

Built, in order of what was judged most valuable (see the research behind it in `reports/`):

1. Retention-aware routing and provider health monitoring
2. CI fee and resource regression checks
3. MCP and agent interface for decode and simulate

Next, none started:

- **Hot reload** for contracts on a local network (`@soroscope/dev`), for testing the way `localhost` serves web development.
- **GraphQL gateway** generated from a contract's spec (`@soroscope/gql`).
- **Fork-testing harness** in TypeScript (`@soroscope/testing`).
- **Differential simulation** across providers (`@soroscope/differential`).
- **SAC / SEP-41 token inspector** and **`stellar.toml` linter** (`@soroscope/inspect`).
- **VS Code extension** for decoded events, auth trees and footprints.

Deliberately avoided: general indexers and explorers, static analysis and fuzzing, WASM step-through debuggers, and source verification while its standards are unsettled. Other projects already serve those.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). In short: no mocks, record fixtures instead of writing them, and say what you could not verify.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/soroscope/soroscope/issues).

## Migrating from `stellar-lens`

Soroscope replaces the `stellar-lens` package. See [MIGRATION.md](./MIGRATION.md).

## License

[MIT](./LICENSE)
