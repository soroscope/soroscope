# Stellar/Soroban debugging, testing, simulation and transaction-inspection tooling (as of 2026-10-08)

Method note: star/fork/push data below was pulled live via the GitHub API/search on 2026-10-08 (cited as [GitHub](https://github.com/<repo>) per repo). The `gh` search API was rate-limited partway, so some queries (mutation testing, GitHub Actions, emulators, coverage) returned nothing; absence there is weak evidence only. "Stale" = no push in >12 months (before Oct 2025).

## 1. What exists per category, and what is abandoned or weak?

### Takeaway
The official stack (stellar-cli, Lab, rs-soroban-sdk testutils, quickstart, fork-testing via snapshots, cargo-fuzz example) is solid but low-level and CLI/Rust-centric. The community layer is mostly very young (2026), tiny (0-15 stars), and many repos look like grant/bounty-wave output (high fork counts, near-zero stars). Older SCF-funded browser IDEs/debuggers (Sorobix, sorolab) are stale. There is no mature, widely adopted Soroban step-through debugger, mutation tester, or hosted TS-native test/simulation harness.

### Cited Findings

**A. Official tooling**
- Stellar docs testing guide lists 12 approaches: unit tests, mocking, auth testing, event testing, integration, fork testing, fuzzing, differential tests, differential tests with test snapshots, mutation testing, code coverage, testing with ledger snapshot. Each is a one-line entry with no tool names, setup steps, or trade-offs; no debugging/diagnostic tools are covered on that page — [Stellar docs: testing](https://developers.stellar.org/docs/build/guides/testing)
- stellar-cli (123 stars, pushed 2026-10-07, active): `contract invoke --send=no` (simulate only), `--build-only` (XDR to stdout), `--cost`, `-v/--vv` TRACE logging, `--no-cache`; `events` (filter by id/topic/type, pretty/json/raw); `xdr` and `strkey` encode/decode; `snapshot create/merge`; `contract fetch/info/read`; `doctor`, `network health/info/settings`, `fees stats` — [CLI reference](https://developers.stellar.org/docs/tools/cli/stellar-cli), [GitHub](https://github.com/stellar/stellar-cli)
- Stellar Lab (112 stars, pushed 2026-10-03): simulate/save/submit with custom RPC, XDR<->JSON conversion, Friendbot, transaction dashboard (XDR, operations, results, meta). I found no source saying Lab shows diagnostic events — [Lab docs](https://developers.stellar.org/docs/tools/lab), [GitHub](https://github.com/stellar/laboratory)
- rs-stellar-xdr (25 stars, pushed 2026-10-08) is the XDR-JSON reference impl and CLI; js-stellar-xdr-json (2 stars, active) brings it to JS; stellar/mcp-stellar-xdr (1 star) and stellar-experimental/mcp-stellar-xdr (2 stars) expose XDR to LLM agents — [GitHub rs-stellar-xdr](https://github.com/stellar/rs-stellar-xdr), [js-stellar-xdr-json](https://github.com/stellar/js-stellar-xdr-json), [mcp-stellar-xdr](https://github.com/stellar-experimental/mcp-stellar-xdr)
- rs-soroban-env contains a `soroban-simulation` crate for end-to-end simulation of transactions (core component, not community) — [GitHub](https://github.com/stellar/rs-soroban-env) (84 stars, active)
- stellar/quickstart (224 stars, pushed 2026-10-06) local network Docker image — [GitHub](https://github.com/stellar/quickstart)
- Fork testing: official flow is `stellar snapshot create --address <C...> [--ledger N]`, then `Env::from_ledger_snapshot_file`. Snapshot is a single point in time; the page lists no formal limits — [Fork testing](https://developers.stellar.org/docs/build/guides/testing/fork-testing)
- Fuzzing: official cargo-fuzz + `arbitrary` example, plus proptest; needs nightly Rust; macOS may need `--sanitizer=thread`; example pinned to soroban-examples v23.0.0. soroban-sdk marks `fuzz_catch_panic` deprecated in favour of `try_` client calls — [Fuzzing](https://developers.stellar.org/docs/build/guides/testing/fuzzing), [_migrating.rs](https://docs.rs/crate/soroban-sdk/25.3.2/source/src/_migrating.rs)
- Error debugging guide: events listed newest-first; unemitted events appear as "Failed Diagnostic Event (not emitted)"; `panic!()` messages are not included in Wasm builds so `WasmVm, InvalidAction` is opaque (use `panic_with_error!`); budget errors need diagnostic events to see which limit was hit — [Debugging errors](https://developers.stellar.org/docs/learn/fundamentals/contract-development/errors-and-debugging/debugging-errors)

**B. Transaction / simulation debuggers and tracers (community)**
- Erst / hintents (dotandev) — 13 stars, 279 forks, 14 open issues, 2,235 commits, pushed 2026-10-05, Apache-2.0. Replays failed transactions locally (Go CLI + Rust simulator) with traces, diagnostic events, TUI trace viewer, flamegraphs, audit-log signing (Ed25519/HSM). README: "Active Development (Phase 4)"; `debug` command fetches the envelope but simulation was marked "pending" in the README; no prebuilt binaries (build from source, Go 1.25 + Rust 1.87); Rust-source mapping is planned, not confirmed — [GitHub](https://github.com/dotandev/hintents), [pkg.go.dev](https://pkg.go.dev/github.com/dotandev/hintents). No funding source stated in README.
- Prism (Toolbox-Lab) — 9 stars, 143 forks, 641 commits, pushed 2026-10-03, MIT. "Soroban transaction debugger": error decoding with suggested fixes, custom error resolution via WASM metadata, replay against historical ledger state, resource profiling, breakpoints/step-through/what-if re-simulation, Rust CLI + VS Code extension + web app, smart-wallet vs ed25519 auth identification. README says Soroban SDK v21 (old; current is v25) and still references the name "Grat"/`grat-soroban/grat`, so docs look stale/inconsistent — [GitHub](https://github.com/Toolbox-Lab/Prism)
- Timi16/soroban-debugger — 15 stars, 149 forks, created 2026-02-14, pushed 2026-06-02 (~4 months idle). "Command-line debugger for Soroban contracts" — [GitHub](https://github.com/Timi16/soroban-debugger). Same-named StellarTreks/soroban-debugger (0 stars) is actually an event decoder — [GitHub](https://github.com/StellarTreks/soroban-debugger)
- Rowell-Holdings/soroban-trace (1 star, pushed 2026-08-31) and Yebom3220/SorobanTrace (0 stars, 2026-09-02): trace/visualize calls, events, state changes from transaction results — [GitHub](https://github.com/Rowell-Holdings/soroban-trace)
- sorocrew/studio (1 star, pushed 2026-10-03): web dev environment with Horizon console, RPC simulation, network toggler; open issue #2 asks for a visual CPU-instruction/memory footprint breakdown because simulation returns raw `cost.cpuInsns`/`memBytes` JSON — [GitHub](https://github.com/sorocrew/studio), [issue 2](https://github.com/sorocrew/studio/issues/2)
- NteinPrecious/soroban-dev-console (0 stars, pushed 2026-09-25): positions itself between CLI-heavy workflow and visual debugging, with correlation-ID tracing — [GitHub](https://github.com/NteinPrecious/soroban-dev-console)
- kfastov/sorolab (0 stars, last push 2024-11-18) "web-based emulator for Soroban transaction debugging" — STALE (~23 months) — [GitHub](https://github.com/kfastov/sorolab)
- Sorobix: SCF-funded ($40,000) browser IDE to compile/deploy/invoke/debug; sorobix-api repo archived April 2023, tied to FutureNet; sorobix/sorobix last push 2023-11-28 (2 stars) — STALE/likely dead — [SCF project](https://communityfund.stellar.org/project/sorobix), [GitHub](https://github.com/sorobix/sorobix). useSoroban.app (in-browser host environment showing ledger changes) and Keizai (Postman-style contract tester) are listed in SDF resources; I could not find repos or confirm current status — [SDF blog](https://stellar.org/blog/developers/learn-soroban-as-easy-as-1-2-3-with-community-made-tooling)
- A Stellar Community Fund submission describes a planned IDE-integrated, AI-enabled Soroban debugger (WASM-level stepping, breakpoints, VS Code/Cursor); it is a proposal, repo not confirmed — [SCF submission](https://communityfund.stellar.org/submissions/recDYQJ63TqlNBacf)
- Colibri (`@colibri/core`) exposes `parseFailedSimulationResponse` returning the root contract error, ordered diagnostic events and error stack — a library, not a debugger — [JSR](https://jsr.io/@colibri/core/doc/~/parseFailedSimulationResponse)

**C. XDR decoders / explorers**
- Old decoders are stale: rabetofficial/xdr-parser (9 stars, last 2021-03), satoshipay/ts-stellar-xdr (4 stars, 2023-04), CarmineOptions/stellar-xdr-decoder (0 stars, 2023-11), Kin `xdrparser` (Python, archive file parser) — [rabet](https://github.com/rabetofficial/xdr-parser), [satoshipay](https://github.com/satoshipay/ts-stellar-xdr), [Carmine](https://github.com/CarmineOptions/stellar-xdr-decoder), [PyPI](https://pypi.org/project/xdrparser)
- withObsrvr/terminal (0 stars, 2026-04-16): "contract-centric block explorer and developer terminal"; withObsrvr/nebu ledger processor — [GitHub](https://github.com/withObsrvr/terminal)
- AyinkxLab/ai-code-assistant (10 stars, pushed 2026-10-07): AI coding assistant with read-only Soroban XDR and transaction decoding tools — [GitHub](https://github.com/AyinkxLab/ai-code-assistant)
- StellarCanary/Protocol-Canary (7 stars, 63 forks, active): protocol compatibility checks for XDR/RPC/Soroban — [GitHub](https://github.com/StellarCanary/Protocol-Canary)
- I did not verify stellar.expert or StellarChain capabilities in this pass (gap).

**D. Fuzzers, property, formal, mutation**
- Komet (Runtime Verification): Rust property tests, `komet test` (fuzz) and `komet prove run` (symbolic execution), installed via `kup`; "supported by the Stellar Foundation" (SCF not confirmed). 41 stars, pushed 2026-09-16, active — [RV blog](https://runtimeverification.com/blog/how-to-get-started-with-komet-property-testing-and-formal-verification-for-soroban), [GitHub](https://github.com/runtimeverification/komet)
- Certora Sunbeam (formal verification; commercial vendor): its Aug 31 2026 blog found cargo-fuzz and `komet test` caught two of three planted adder bugs but missed one failing on 1 in ~4 billion inputs; cargo-fuzz harness needed ~50 lines and a modified contract. Vendor-authored, tiny experiment — [Certora](https://www.certora.com/blog/formal-verification-vs-fuzzing)
- Soroban-Static-Analysis-Fuzzing-Toolkit/Soroban-Fuzzer — 7 stars, 10 forks, pushed 2026-09-15; analyzer (5 detectors, SARIF), stateful invariant fuzzer with shrinking, static budget estimator, GitHub Action. Self-described limits: heuristic rules, "model-first blind spot", budget not a CPU prediction, test host expires temp entries lazily on read, Rust 1.91+ — [GitHub](https://github.com/Soroban-Static-Analysis-Fuzzing-Toolkit/Soroban-Fuzzer)
- Aimeedeer/soroban-token-fuzzer — reusable fuzzer for token-interface contracts, last push 2024-03-21 (STALE ~30 months), tested only on native + example token — [GitHub](https://github.com/Aimeedeer/soroban-token-fuzzer)
- Other tiny/new: yarobanza/soroban-fuzz (0, 2026-07), robustfengbin/soroban-invariant-fuzzer (0, 2026-06), Stephan-Thomas/soroban-invariant-kit (1), Reckon-co/reckon-Frontend (fuzz campaign report UI, 0), ecksbe/soroban-invariant-checks (0), caliperforge/soroban-invariant-atlas (0) — all via GitHub search 2026-10-08
- Scout (CoinFabrik) static analyzer: 46 stars, last push 2024-11-07 (STALE ~11 months, borderline) — [GitHub](https://github.com/CoinFabrik/scout-soroban)
- Mutation testing: official docs list it as an approach but no dedicated Soroban mutation tool surfaced in my searches (cargo-mutants is generic Rust; not verified for Soroban). Open stellar-tags issue #671 requests a CI fuzz suite — [issue](https://github.com/Abdulazeem-code/stellar-tags/issues/671)

**E. Fork / local-network / mocking / test frameworks**
- soroban-fork (lobotomoe): lazy-loading mainnet/testnet fork ("Anvil-equivalent"), caches to `stellar snapshot create` format, 10 pre-funded accounts, call-tree tracing, auth-tree introspection, live-network resource-fee calc for simulateTransaction. crate v0.9.5 (2026-08-16), 0 GitHub stars, pushed 2026-06-03; Rust-only, x86_64 docs only, needs soroban-sdk ^25.3 — [docs.rs](https://docs.rs/soroban-fork), [GitHub](https://github.com/lobotomoe/soroban-fork). Also silhilston/soroban-fork-test (0 stars, CLI, 2026-06-23)
- It is an in-process Rust test env, not a persistent forked node that wallets/JS SDK can point at. Inference from docs; no JS-accessible fork RPC found.
- cokehill/soroban-test-utils (0 stars, one commit 2026-04-30): JS/TS testing lib — mock ledger, assertions, state-expiration simulation, resource profiling ("Hardhat/Foundry equivalent") — [GitHub](https://github.com/cokehill/soroban-test-utils)
- Akinyemi04/soroban-test-kit (mocks, assertions, fuzz harnesses), kawokudi/soroban-test-gen (generates #[test] suites from Rust source), Aycode01/soroban-mock-go (mock state and RPC calls), SorobanGuard-Labs/soroban-testbench — all 0 stars, 2026
- MDTechLabs/DevNode-Dash (1 star): GUI for Anvil and Stellar Quickstart (2026-01-18) — [GitHub](https://github.com/MDTechLabs/DevNode-Dash)

**F. Fee / resource profilers, event viewers**
- CollinsKRO/Soroban-Profiler (0 stars, 2026-09-10): runs test suite, per-function resource breakdown, flags proximity to network limits; rahul-soshte/fee-simulator (0, 2026-03); SoroSLO (synthetic SLO monitoring, simulation-only checks). Event tools: coolhillblack/soroban-event-indexer (4 stars), poaspergillus/soroban-events (RPC ingestion, ScVal decoding), Soroban-Forge/soroban-events-explorer; kalepail/soroban-events-queue (2023, STALE) — all via GitHub search 2026-10-08

### Inferences
- Repo patterns (many 0-star repos with 100+ forks, created within weeks, mirrored phrasing like "transaction debugger") fit bounty/grant-wave generation (Drips Wave style); star counts understate real use, and quality/maintenance is uncertain. Treat as unverified.
- Stale tier: Sorobix, sorolab, soroban-token-fuzzer, xdr-parser/ts-stellar-xdr, Scout (borderline). Biggest organic adoption among community tools appears to be Komet (41) and Erst/Prism/Timi16 (9-15).
- No tool found offers: true WASM step-through with Rust-source mapping that works today (Erst: planned; Prism: claimed, unverified), a fork-as-RPC-node, or a TS-native test framework with real adoption.

### Gaps
- Not verified: stellar.expert / StellarChain / Stellar Expert tx and contract decoding; Scout/Sunbeam current state; useSoroban.app, Keizai status; whether Prism/Timi16 debuggers actually work end to end (no hands-on testing done).
- Mutation-testing and CI-helper (GitHub Action) searches hit GitHub rate limit; coverage is weak.

## 2. What do Stellar devs complain about?

### Takeaway
Direct first-hand forum/Discord complaint threads were NOT retrievable (web search surfaced mostly GitHub issues and tutorial stubs). Indirect evidence points to: opaque simulation/host errors, hard-to-read resource costs, missing structured debugging workflow docs, and CLI-only workflows.

### Cited Findings
- Debugging guide itself admits `panic!` messages vanish in Wasm builds, leaving `WasmVm, InvalidAction` generic; recommends `panic_with_error!` — [Debugging errors](https://developers.stellar.org/docs/learn/fundamentals/contract-development/errors-and-debugging/debugging-errors)
- stellar-cli issue: `token mint --to` advertises `M...` accounts but fails with an "opaque host error" — [issue 2772](https://github.com/stellar/stellar-cli/issues/2772)
- stellar-cli issue 818: inconsistencies in logging results and events from invocations — [issue 818](https://github.com/stellar/stellar-cli/issues/818)
- stellar-cli issue 2622: structured output and error hardening for the CLI (output, errors, `--describe`) — [issue 2622](https://github.com/stellar/stellar-cli/issues/2622)
- stellar-cli issue 735: CLI parsing error for a relatively basic custom `Vec` type (10 comments) — [issue 735](https://github.com/stellar/stellar-cli/issues/735)
- sorocrew/studio issue: simulation cost is raw numbers in JSON; wants visual footprint breakdown — [issue 2](https://github.com/sorocrew/studio/issues/2)
- Open issue to write a debugging flow guide (reproduce, isolate, verify) in Soroban Cookbook; and a 2026 tutorial request on simulation errors, auth failures, footprint issues — [Cookbook #77](https://github.com/Soroban-Cookbook/Soroban_Cookbook_online/issues/77), [stellar-dev-dashboard #907](https://github.com/Nanle-code/stellar-dev-dashboard/issues/907)
- Fuzzing friction: ~50-line harness, nightly toolchain, contract modification, deprecated `fuzz_catch_panic` — [Certora](https://www.certora.com/blog/formal-verification-vs-fuzzing), [docs](https://developers.stellar.org/docs/build/guides/testing/fuzzing)
- Erst README itself positions the project around the "black box" debugging experience on Soroban — [Erst GitHub](https://github.com/dotandev/hintents)

### Inferences
- Pain concentrates on (1) error attribution, (2) budget/footprint legibility, (3) reproducibility of mainnet failures, (4) test setup cost.

### Gaps
- No Discord, stellar-dev forum, Reddit, or Drips Wave issue-list evidence retrieved; claims above are GitHub issues only. Recommend manual review of Stellar Dev Discord #soroban channels and Wave issue lists.

## 3. Gaps a TS SDK/CLI/web tool with RPC routing, Soroban simulation and XDR error decoding could extend into

### Takeaway
Most community tools are Rust/Go, single-RPC, and lack TS-native ergonomics. The natural extensions are those that reuse simulation + RPC + decoding: a failure-explainer, multi-RPC differential simulation, JS-accessible replay/fork, and resource/fee diffing in CI.

### Cited Findings
- Colibri already parses failed simulation into contract error + ordered diagnostic events (JSR) — so error-decoding alone is partially served — [JSR](https://jsr.io/@colibri/core/doc/~/parseFailedSimulationResponse)
- Lab does simulation/XDR-JSON but I found no diagnostic-event viewer there — [Lab docs](https://developers.stellar.org/docs/tools/lab)
- soroban-fork already provides fee calc for simulateTransaction and call-tree tracing, but only inside Rust tests — [docs.rs](https://docs.rs/soroban-fork)
- Erst already does replay + diagnostic events + TUI, but pre-alpha, build-from-source, and Go/Rust — [GitHub](https://github.com/dotandev/hintents)

### Inferences (candidate opportunities, ranked by fit)
1. Failed-transaction explainer: hash or XDR in, decoded host error + diagnostic-event tree + contract error enum name (from Wasm spec) + suggested fix. Competes with Prism/Erst; differentiator is TS/web/npm and no Rust toolchain.
2. Diagnostic-event and call-tree viewer for simulation results (Lab gap), with auth-tree and footprint/rent visualisation (addresses raw cpu/mem JSON complaint).
3. Multi-RPC differential simulation: run the same tx against several RPC providers/ledgers and diff results/fees (leverages RPC routing; no tool found doing this).
4. Resource/fee regression in CI: simulate fixtures, compare cpu/mem/footprint/fee to baseline, fail PR; a GitHub Action (only Soroban-Fuzzer's analyzer Action found; Profiler is Rust, 0 stars).
5. JS/TS test harness over RPC + snapshot (mock ledger, state expiry, auth mocking), since the only TS option (soroban-test-utils) has 1 commit and 0 stars.
6. Fork-as-service: snapshot + lazy RPC proxy that JS SDK/wallets can target (soroban-fork is Rust in-process only).
7. Version-drift guard (XDR/protocol upgrade compatibility): Protocol-Canary exists but is small; adjacent opportunity.
8. MCP/agent interface for decode+simulate (stellar mcp-stellar-xdr only covers XDR).

### Gaps
- No data on actual demand or willingness to adopt; no usage/download figures (npm/crates.io) collected; Erst/Prism claims not tested hands-on.
