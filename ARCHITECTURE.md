# Architecture

This is a map for people who want to change Soroscope. It says where things live, how a call flows through them, and which rules the code is built around. For setup, conventions and the pull request process, read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## The idea

Stellar RPC providers differ in ways their `getHealth` response does not tell you: how far back `getTransactions`, `getEvents` and `getLedgers` can really answer, how far they lag the network, and how they behave when rate limited. Soroscope measures those differences and routes calls only to a provider that can serve them. Everything else in the repository (the CLI, the CI check, the MCP server) is a consumer of that routing plus a set of XDR and contract-spec decoders.

## Packages and how they depend on each other

```
core  ──►  invoke  ──►  ci  ──►  cli
  │           │          └─────►  mcp
  └───────────┴────────────────►  cli, mcp   (they use core and invoke directly too)
```

Read an arrow as "is used by". `core` is at the bottom and depends on nothing; `cli` and `mcp` sit at the top and use everything below them.

| Package | Role | Runtime dependencies | Published |
|---|---|---|---|
| `core` | Router, provider registry, probe, decoders, contract specs, simulation reports | none | yes |
| `invoke` | Build a contract call from a spec; deploy WASM; send a transaction; friendbot | `core`, `@stellar/stellar-sdk` | yes |
| `ci` | Measure invocations, compare with a committed baseline, render a PR comment; the Action | `core`, `invoke`, `@stellar/stellar-sdk`, `zod` | yes |
| `cli` | `soroscope probe`, `route-explain`, `decode`, `explain`, `spec`, `simulate`, `check` | `core`, `invoke`, `ci`, `commander`, `@stellar/stellar-sdk` | yes |
| `mcp` | Read-only MCP server | `core`, `invoke`, `ci`, `@modelcontextprotocol/sdk`, `zod` | yes |
| `test-utils` | Fixture recorders and the fixture contract | none | private |
| `demo` | Documentation site (Next.js); `content/` is the source of the docs | | private |
| `dev` | In-process Soroban engine (`dev/engine`, Rust + N-API, embeds `soroban-env-host` and `soroban-simulation`), watch-rebuild-swap loop, spec-typed calls; spec parsing and TypeScript codegen from Orbital (`@orbital-stellar/abi-registry`) | `@soroscope/core`, `@orbital-stellar/abi-registry`, `@stellar/stellar-sdk` | private |
| `testing`, `differential` | Scaffolds: they build and export types, with no implementation | | private |
| `gql`, `inspect`, `vscode` | Frozen: scaffolds that are not planned | | private |

**The rule that shapes the graph:** `core` has no runtime dependencies. Anything that needs the Stellar SDK, a schema validator or a CLI framework belongs in a package above it. If `core` needs something the platform lacks, raise it as a design question before adding a dependency.

## `core` module by module

All paths are under `packages/core/src`.

| Directory | What it does |
|---|---|
| `rpc/` | Transport to one endpoint. `RpcClient` makes JSON-RPC calls and reports HTTP status, `Retry-After` and latency. `errors.ts` defines the error classes. `classify.ts` turns an error into a `FailureClass` and parses the "out of retention" messages. `methods.ts` holds each RPC method's profile and works out which ledger a request needs. |
| `routing/` | `ProviderRegistry` (state and decisions, no I/O) and `SoroscopeRouter` (does the calls). `catalog.ts` lists public providers per network. |
| `probe/` | `probeProviders` measures latency, lag, retention and real `getLedgers` reach. `format.ts` renders table, JSON and Prometheus output. |
| `xdr/` | A minimal XDR reader and writer, base64 helpers and strkey encoding. No SDK. |
| `decode/` | Decoders: `ScVal`, diagnostic events, auth entries, Soroban transaction data, ledger keys and entries, transaction results. |
| `spec/` | Parse a contract's WASM custom section into functions, types, events and named errors; fetch a spec from the network. |
| `simulation/` | `TransactionSimulator` runs `simulateTransaction` through any `RpcCaller` and returns a decoded `SimulationReport`. |

### Method profiles: the input to every routing decision

`rpc/methods.ts` gives each RPC method a `MethodProfile`:

- `weight` is `light` or `heavy`. Latency is tracked separately for each.
- `needsFresh` means the method reads current state, so a provider that lags the network is a poor choice (`getLatestLedger`, `getLedgerEntries`, `simulateTransaction`, `sendTransaction`).
- `history` is `none`, `window` or `deep`. `window` methods (`getTransactions`, `getEvents`) are bound to the advertised retention window. `deep` (`getLedgers`) is the one method some providers serve from a data lake far beyond that window, so its reach has to be probed instead of read from `getHealth`.

`startLedgerOf` reads the oldest ledger a request needs from its params: `startLedger`, or the ledger encoded in a pagination cursor (a paging token is a TOID, with the sequence in the high 32 bits). Unknown methods get a neutral profile and are still routable.

### What happens on `router.call(method, params)`

`SoroscopeRouter.callDetailed` in `routing/SoroscopeRouter.ts`:

1. Work out `startLedger` from the call options or the params.
2. If a start ledger matters and some provider has never reported its bounds, ask it `getHealth` once.
3. Ask `ProviderRegistry.eligible()` which providers can serve the request. It returns the ranked providers and, for each one ruled out, a reason string. A provider is excluded when it is:
   - the wrong one when a `pin` is set, or already tried in this call
   - marked misconfigured (auth failure or a bad path)
   - behind an open circuit breaker
   - rate limited
   - known not to support the method
   - lagging the network by more than `maxLagLedgers`, for `needsFresh` methods
   - not retaining `startLedger`, or not yet at it
4. Providers whose `getLedgers` reach is unknown are not excluded for old ledgers. They are tried last, because unknown is not the same as absent.
5. Rank by smoothed or p95 latency for the method's weight, scaled up by lag, doubled when `degraded`, and divided by the provider's `weight`. Ties break on provider id, so ranking is deterministic.
6. Call the best provider. On success, record latency and the ledger bounds the response reports. On failure, classify it and record it; the registry updates the circuit breaker and rate-limit state.
7. Fail over to the next provider, up to `maxAttempts`, with these exceptions:
   - `invalid_request` is thrown immediately, because bad input fails the same way everywhere.
   - `sendTransaction` is retried only when the failure provably did not reach the node (`network` or `timeout`). A signed transaction may already have been accepted.
8. If nothing is eligible but a provider recovers within `maxWaitMs`, wait once. Otherwise throw `NoEligibleProviderError` (nobody could ever serve it, with reasons) or `AllProvidersFailedError` (everyone eligible was tried and failed, with attempts).

`explain()` runs steps 1 to 5 and returns the result without calling anything. It is what `soroscope route-explain` prints.

### Why `ProviderRegistry` does no I/O

The registry takes its clock as a parameter and never touches the network, so its decisions are deterministic and can be tested without waiting. The router feeds it observations (`recordSuccess`, `recordFailure`, `recordHealth`, `recordChain`) and asks it for decisions. `snapshot()` and `restore()` round-trip its state through JSON.

### Reach evidence expires

A provider's `getLedgers` reach is a measurement with a ten-minute lifetime (`REACH_TTL_MS`). The same endpoint can answer one request and refuse the next, probably because a load balancer fronts mixed backends. The probe therefore retries a refusal once and flags `consistent: false` when the two answers differ, which the table shows as `?`.

## Simulation and contract errors

`TransactionSimulator.simulate` calls `simulateTransaction` and decodes the response into a `SimulationReport`. `simulateAndExplain` additionally fetches the contract's spec when the failure is a contract error, and resolves the numeric code to the name the contract declares (`Error(Contract, #2)` becomes `Error::InsufficientFunds`). The spec lookup is best effort: if it fails, the original failure is returned unchanged.

## The CI check (`packages/ci`)

`runChecks` in `src/run.ts` is the engine; `src/action.ts` is the GitHub Action wrapper around it, and `action/index.cjs` is its committed bundle.

- **Mode A** simulates calls against an already-deployed `contractId`. Works on testnet and mainnet.
- **Mode B** reads compiled WASM named under `contracts` in `soroscope.config.json`, deploys it to testnet with a throwaway key funded by friendbot, runs the declared `setup` calls, then simulates. This measures a pull request's own code. It refuses any network but testnet.
- Each measurement (instructions, disk read bytes, write bytes, resource fee, read-only and read-write footprint keys, auth entries, events) is compared with a committed baseline in `compare.ts`. Defaults fail on a rise of more than 5% in instructions and read or write bytes, and warn on 10% in resource fee, because the fee also moves with network fee settings.
- Addresses that differ on every run (the deployed contract id, the throwaway deployer) are replaced by `$alias` names before comparing, so two runs of the same code produce equal measurements.
- A baseline recorded under a different protocol version is flagged (`environmentChanged`), so a network upgrade does not look like a regression.

## The MCP server (`packages/mcp`)

The server registers read-only tools: `rpc_status`, `rpc_route_explain`, `decode_xdr`, `explain_error`, `get_contract_spec`, `simulate_invocation`, `simulate_transaction`, `get_transaction`, `get_events`, `get_ledger_entries` and `check_baseline`. Two guards in `src/guards.ts` apply to every tool:

- `rejectSecrets` refuses any input in which a string decodes as a Stellar secret seed, checked by strkey version byte and payload length rather than by pattern alone.
- `assertPublicHttpsUrl` is applied to any caller-supplied RPC URL (which is also off unless `SOROSCOPE_MCP_ALLOW_CUSTOM_RPC=1`). It requires https, forbids embedded credentials and local hostnames, and resolves the host so that every address must be public. This closes the path by which a model could be steered into probing internal services.

Nothing in `core`, `cli` or `mcp` signs or submits a transaction. Signing exists only in `invoke`, and the CI check uses it only to deploy to testnet with a throwaway key.

## How the tests are organised

The central rule is that **nothing is mocked**. See the [testing rule in CONTRIBUTING.md](./CONTRIBUTING.md#the-testing-rule-nothing-is-mocked); this section is the structure behind it.

| Kind | Where | Runs with | Network |
|---|---|---|---|
| Unit | `packages/*/tests/unit` | `pnpm test` | none; reads recorded fixtures |
| Live integration | `packages/*/tests/integration` | `pnpm test:integration` | public testnet providers |
| Fixture provenance | `packages/test-utils/scripts/check-fixtures.mjs` | `pnpm check:fixtures` | none |
| Doc example drift | `scripts/check-doc-examples.mjs` | `pnpm docs:test` | none |

- **Recorded fixtures.** `packages/test-utils/scripts` records real RPC responses and real Soroban XDR into `packages/core/tests/fixtures`. Every fixture has a `provenance` block (tool, time, network, ledger, CLI version).
- **The oracle.** For XDR, the recorder also stores what the official `stellar xdr decode` prints for the same bytes. `tests/helpers/oracle.ts` maps Soroscope's decoded tree onto that JSON shape, so a decoder test is `expect(toOracle(decode(blob))).toEqual(official)`. Contract specs are checked the same way against `stellar contract info`.
- **Known gaps.** `COVERAGE.md` beside the fixtures lists every XDR union arm and how many real examples the corpus has. An arm marked **not covered** has a decoder that has never been compared with the official tool. Closing those gaps is open work.
- **The fixture contract.** `packages/test-utils/fixture-contract` is a small Soroban contract with named errors, auth, typed events, all three storage durabilities, and two cost knobs: `work(n)` burns CPU in proportion to `n` and `touch(n)` writes `n` entries. It is deployed to testnet; its id is in `packages/test-utils/fixtures/fixture-contract.json`. Tests that need a regression use it with two different `n`, instead of editing a number.
- **A lint rule bans** `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.stubGlobal` and `vi.stubEnv`.

Live suites depend on public infrastructure and can fail when a provider is degraded, so they run in their own workflow and do not gate merges.

## Docs flow

`packages/demo/content` is the source of truth. `pnpm docs:gen` regenerates the error reference, the API reference and the top-level `docs/` directory from it. Files in `docs/` carry a "Generated from ..." header; do not edit them by hand. `pnpm docs:test` fails if a documented example imports a symbol a package does not export.

## Where to start

| If you want to... | Start in |
|---|---|
| Change how a provider is chosen | `core/src/routing/ProviderRegistry.ts` (`eligible`, `rank`) |
| Teach the router about a new RPC method | `core/src/rpc/methods.ts` (add a profile) |
| Add or fix a decoder | `core/src/decode`, then record a fixture ([guide](./packages/test-utils/ADDING-A-FIXTURE.md)) |
| Add a CLI command | `cli/src/commands`, registered in `cli/src/cli.ts` |
| Add a metric to the CI check | `ci/src/metrics.ts`, `ci/src/compare.ts` |
| Add an MCP tool | `mcp/src/server.ts` (the `tool(...)` helper applies the secret check) |
| Implement a scaffold package | its README says what it should do; ask in an issue before starting |
