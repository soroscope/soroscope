# Stellar/Soroban Smart Contract Development, Security and Audit Tooling

Snapshot date: 2026-10-08. Star counts and "last push" dates come from the GitHub API (`gh api repos/...` and repo search), pulled on this date. Cited as [GitHub API](https://api.github.com). Stale means no push in more than 12 months, so a last push before 2025-10-08. Descriptions marked "(desc only)" come from the repo description or a search snippet. I did not read the code, so I can't say whether the claims are true or whether the tool works.

Caveat for the report writer: many 0-5 star repos created May-Oct 2026 look like Drips Wave / SCF micro-grant submissions. They are young (created 2026-05 to 2026-09, per `created_at`), carry near-zero stars, and several use near-duplicate names (for example several "soroban-lint" and "soroban-cost-linter" repos). Treat them as unproven.

## What exists per category, and what is abandoned, weak or missing?

### Takeaway
The mature layer is small: Scout (static analysis), Certora Sunbeam and Runtime Verification Komet (formal verification and fuzzing), the OpenZeppelin Stellar Contracts library, and the official SDKs and CLI. Around it is a crowd of very new, near-zero-star community tools in the TTL/archival, upgrade-safety, source-verification and linter niches. Of the categories asked about, I found no maintained wasm-size optimizer or resource-budget regression tool, and no bindings generator for Go, Kotlin or Swift. Binding generators exist for TS (official) and Java/Python (community).

### Cited Findings

#### Static analyzers / linters
- Stellar's official security-tools page lists four tools: Scout (CoinFabrik), Almanax (AI security engineer, CI integration), Certora Sunbeam, and the Soroban Security Portal (Inferara). Raven MCP and Stellar Skills are listed under "for agents". — [Stellar docs](https://developers.stellar.org/docs/tools/developer-tools/security-tools)
- **Scout** (CoinFabrik/scout-audit): 49 stars, last push 2026-09-29, active. Latest commit is a README refresh for Scout 0.3.17. — [GitHub API](https://github.com/CoinFabrik/scout-audit). The old standalone repo CoinFabrik/scout-soroban has 46 stars and its last push was 2024-11-07, so it is stale and superseded by scout-audit. — [GitHub](https://github.com/CoinFabrik/scout-soroban). CoinFabrik/scout-actions (GitHub Action): 16 stars, last push 2025-05-05, about 17 months stale. — [GitHub](https://github.com/CoinFabrik/scout-actions). CoinFabrik/scout-soroban-examples: 29 stars, last push 2024-05-28, stale.
- Scout's Soroban docs list 23 detectors: divide-before-multiply, unsafe unwrap/expect, overflow-check, insufficiently random values, unprotected update of current contract wasm, avoid mem::forget, set contract storage, avoid panic error, avoid unsafe block, DoS unbounded operation, soroban version, unused return enum, iterators over indexing, assert violation, unprotected mapping operation, DoS unexpected revert with vector, unrestricted transfer_from, unsafe map get, incorrect exponentiation, integer overflow/underflow, storage-change events, token-interface events. — [Scout docs](https://coinfabrik.github.io/scout-soroban/docs/detectors). None of the 23 is a TTL/archival, extend_ttl or cross-contract-reentrancy detector (my reading of the list).
- SCF funding for Scout: #20 ($50k), #23 ($100k), #27 ($90k), totalling $240k, plus a later "Scout Bug Fighter" entry (SCF #30, $150k) that may or may not be counted in that total. — [SCF Scout page](https://communityfund.stellar.org/project/scout)
- Certora's April 2026 audit-prep guide says Stellar's Audit Bank pre-audit phase expects self-service tools such as Scout. — [Certora blog](https://www.certora.com/blog/roadmap-to-a-soroban-security-audit)
- **OpenZeppelin/soroban-security-detectors-sdk**: 8 stars, last push 2026-09-01, "Stellar Soroban security detectors SDK" (desc only). — [GitHub API](https://github.com/OpenZeppelin/soroban-security-detectors-sdk). Little public documentation found.
- **CoinFabrik/soroban-audit-harness**: 3 stars, created 2026-09-28, "repository-first and knowledge-guided AI-assisted security analysis" (desc only). — [GitHub](https://github.com/CoinFabrik/soroban-audit-harness)
- **Tollcraft/soroban-cost-linter**: 31 stars, created 2026-07-02, last push 2026-10-05; "input-independent resource cost anti-patterns" (desc only). It is the most-starred of the new community linters. — [GitHub](https://github.com/Tollcraft/soroban-cost-linter). Forks or clones with the same name: Soroban-Cost-Linter/soroban-cost-linter (3 stars), BABAT-CODE/soroban-cost-linter (1 star).
- **HyperSafeD/Sanctifier**: 5 stars, created 2026-01-24, last push 2026-10-05; "static analysis, runtime guards, formal verification bridge" (desc only). Clones also exist: Centurylong/sanctifier (2 stars), Bojest001/Sanctifier. — [GitHub](https://github.com/HyperSafeD/Sanctifier)
- **Soroban-Guard/Actions** (3 stars, created 2026-07-13): a GitHub Action that, per a search snippet, detects reentrancy, arithmetic overflow, access control flaws and storage collisions, with SARIF upload. — [GitHub](https://github.com/Soroban-Guard/Actions). The snippet does not mention TTL. akordavid373/soroban-guard (0 stars, last push 2026-03-11) is a "security linter" with an "invariant scanner" (desc only).
- Other new linters (all 0-1 stars, 2026): use-plumbline/plumbline (AST linter shipped as a GitHub Action), Soroban-Lint/soroban-lint, spiffamani/soroban-lint, Stellar-Soroban-Lint/* (core, action, portal), Bidex-cmyk/stellar-guard-sdk (Rust CLI and GitHub Action), Soro-Forge/soroban-forge, Clawue884/soroban-static-analyzer, summer-0ma/Soroban-Sentinel, lialamanroll/optima-profiler (wasm fee/XDR optimization static analysis), Stackgirl01/stellar-security-gate (secret scanning and dependency audit action). — [GitHub search, 2026-10-08](https://github.com/search?q=soroban+lint&type=repositories)
- **VeridionLabs/veridion**: 11 stars, created 2026-07-07, "AI-powered smart contract security platform" with audit reports and on-chain verification of audit results (desc only). — [GitHub](https://github.com/VeridionLabs/veridion)
- **Almanax**: closed-source commercial AI security engineer; no repo. — [Stellar docs](https://developers.stellar.org/docs/tools/developer-tools/security-tools)
- Clippy: the search found no Soroban-specific clippy lint set. `stellar/rs-soroban-sdk` has 206 stars and is active (last push 2026-10-08). — [GitHub API](https://github.com/stellar/rs-soroban-sdk)

#### Formal verification and fuzzing
- **Certora Sunbeam**: specs are Rust functions marked `#[rule]` (CVLR). Sunbeam compiles spec plus contract to WebAssembly and verifies the bytecode, so the Rust compiler is outside the trusted base. — [Certora docs](https://docs.certora.com/en/latest/docs/sunbeam/index.html). Used to verify Blend V1 (Nov 2024 to Jan 2025). — [Certora report](https://www.certora.com/reports/blend-smart-contract-verification-report). Certora/sunbeam-tutorials: 1 star, last push 2025-11-05. — [GitHub API](https://github.com/Certora/sunbeam-tutorials). Certora/sunbeam-vs-other-tools: 1 star, pushed 2026-08-10. The Sunbeam source is not in a public repo I could find; the open Certora/CertoraProver has 336 stars and was pushed 2026-09-07. — [GitHub API](https://github.com/Certora/CertoraProver)
- Certora (vendor) published an Aug 2026 comparison of Sunbeam, cargo-fuzz and Komet; it is a vendor-authored framing. — [Certora blog](https://www.certora.com/blog/formal-verification-vs-fuzzing)
- **Komet** (Runtime Verification): property tests in Rust; `komet test` fuzzes, `komet prove run` does symbolic proof. SCF-funded. The launch post said only a limited set of Soroban host functions was supported at the time. Whether full coverage has since shipped is unconfirmed. — [RV docs](https://docs.runtimeverification.com/komet), [launch post](https://runtimeverification.com/blog/introducing-komet-smart-contract-testing-and-verification-tool-for-soroban-created-by-runtime-verification). Repo runtimeverification/komet: 41 stars, last push 2026-09-16, active. — [GitHub API](https://github.com/runtimeverification/komet)
- Other SCF-funded security work: Soroban Assistant "DYET" AI fuzzer ($55k total); Solarkraft runtime monitoring ($117k); Extractor post-deployment protection ($50k). — [SCF Scout/related pages](https://communityfund.stellar.org/project/soroban-assistant). I did not confirm the current repo status of these three.
- Small fuzz repos: brson/soroban-token-fuzzer (3 stars, last push 2024-03-24, stale), brson/soroban-wasm-fuzz-test (stale), Soroban-Static-Analysis-Fuzzing-Toolkit/* (7 stars, 2026-09), SorobanCrashLab/soroban-crashlab (3 stars, 2026-10-05), robustfengbin/soroban-invariant-fuzzer, benelabs/crucible (17 stars, test helpers, pushed 2026-10-01). — [GitHub search](https://github.com/search?q=soroban+fuzz&type=repositories)
- GaloisInc/formal-verso ("Formal Verification for Soroban"): 3 stars, last push 2025-05-05, stale (about 17 months). — [GitHub](https://github.com/GaloisInc/formal-verso)

#### TTL / rent / archival analyzers (all new, near-zero stars)
- **sorolens/sorolens**: 10 stars, created 2026-07-26; observability for events, storage TTL, invocation health. — [GitHub](https://github.com/sorolens/sorolens)
- **Guardaora/archguard-app** (11 stars) and archguard-contract (9 stars): a keeper daemon plus a Next.js dashboard for TTL extension. Last push 2026-08-10. — [GitHub](https://github.com/Guardaora/archguard-app)
- **ledgerkeep/ledgerkeep-cli** and **ledgerkeep-core** (3 stars each, Aug 2026): a CLI that watches TTL over RPC and extends it, plus a Rust interface and on-chain registry. — [GitHub](https://github.com/ledgerkeep/ledgerkeep-cli)
- **soroban-doc-ttl/soroban-ttl-doctor** (0 stars, Sep 2026, "audits contract storage entries for TTL/archival risk"), plus backend and action repos; **Persist-ttl/persist-core** and persist-actions (0 stars, Sep 2026, static analysis of storage-lifecycle bugs); **TegoLabs/sorokeep** (2 stars); **soroban-ttl-guardian** (0 stars, TypeScript monitor). — [GitHub](https://github.com/soroban-doc-ttl/soroban-ttl-doctor)
- Soroban-Storage-Lifecycle/... (7 stars, Sep 2026), princceeeee/soroban-storage-optimizer (0 stars, storage cost anti-patterns). — [GitHub](https://github.com/search?q=soroban+ttl&type=repositories)
- Veridise notes that persistent entries can be archived and restored, so contracts must handle state that may be absent, and that instance storage avoids archival concerns. — [Veridise](https://veridise.com/blog/learn-blockchain/how-is-stellar-funding-smart-contract-security-at-scale/)
- The Inferara Soroban Security Portal repo (10 stars, pushed 2026-10-01, Apache-2.0) is a vulnerability and audit database. Its README page does not enumerate categories or TTL entries, so I could not confirm TTL coverage. — [GitHub](https://github.com/Inferara/soroban-security-portal)

#### Upgrade / migration safety
- **ShippedLabs/soroban-upgrade-safeguard**: 3 stars, created 2026-05-13, pushed 2026-10-03; compares two WASM builds and flags storage layout breaks, permission escalations and missing migrations (desc only). — [GitHub](https://github.com/ShippedLabs/soroban-upgrade-safeguard)
- coolhillblack/soroban-migration (0 stars, WASM diff and upgrade plan), Hollujay/soroban-drift (0 stars, breaking-change catch), SorobanLabs/sorobanlabs-analyzer (0 stars, what changes when replacing a deployed contract), SaboLabs/soroban-devkit (5 stars, release assurance incl. upgrade comparison, pushed 2026-10-08), Soroban-Contract-Upgrade-State-Migration-Framework (7 stars), SoroForge/Soroban-guard (timelock/multisig upgrade framework). — [GitHub search](https://github.com/search?q=soroban+upgrade+migration&type=repositories)
- StellarCanary/ProtocolCanary-Action (4 stars): CI compatibility checks, apparently against protocol changes (desc only). — [GitHub](https://github.com/StellarCanary/ProtocolCanary-Action)
- Scout has an "unprotected update current contract wasm" detector. — [Scout docs](https://coinfabrik.github.io/scout-soroban/docs/detectors)

#### Contract spec / ABI / binding and client generators
- Official: stellar-cli (123 stars, pushed 2026-10-07), js-stellar-sdk (694 stars, pushed 2026-10-07), js-stellar-base (122 stars). — [GitHub API](https://github.com/stellar/stellar-cli). stellar/js-soroban-client is archived (24 stars, last push 2024-07-22). stellar/go is archived (last push 2025-12-10); this is a repo-level fact I saw, and I did not check where Go tooling moved.
- **lightsail-network/stellar-contract-bindings**: 11 stars, pushed 2026-09-29; CLI that generates bindings (desc only; I did not confirm which languages). — [GitHub](https://github.com/lightsail-network/stellar-contract-bindings)
- Other SDKs: StellarCN/py-stellar-base (368 stars, pushed 2026-09-29), lightsail-network/java-stellar-sdk (202 stars, 2026-09-23), Soneso/stellar_flutter_sdk (88 stars, 2026-10-07), Soneso/stellar-ios-mac-sdk (132 stars, 2026-10-07). These are general SDKs. I did not verify whether each generates typed bindings from a contract spec.
- Python: tupui/soroban-cli-python (7 stars, Aug 2026), ligulfzhou/pysoroban (2 stars). Swift: christopherkarani/starscream (1 star, Swift 6.2 Soroban client), jude-bell/SorobanSwiftSDK (0). Go: soroauth/soroauth-go (4 stars, builds and inspects Soroban authorization entries). Kotlin: I found only a few 1-star Android apps. No dedicated Kotlin binding generator found. Dart: DojoCodingLabs/trustless-work-dart (0 stars). — [GitHub search](https://github.com/search?q=soroban+python&type=repositories)
- TS generators: kawokudi/soroban-sdk-gen (0 stars), payrouteshq/sorokit (React hooks and Zod forms generated from spec, 0 stars), silence48/new-soroban-fiddle (0 stars, last push 2024-09-10), MDTechLabs/SpecDoc (1 star, doc generator from ABIs). — [GitHub search](https://github.com/search?q=soroban+contract+spec&type=repositories)
- Raven MCP: stellar-experimental/stellar-raven, 9 stars, pushed 2026-10-08 (moved from kalepail/stellar-raven, archived). passkey-kit and smart-account-kit moved from kalepail to the stellar org. — [GitHub](https://github.com/stellar-experimental/stellar-raven)

#### Scaffolding / templates / SDK extensions
- **OpenZeppelin/stellar-contracts**: 97 stars, pushed 2026-10-07. Audited fungible, non-fungible and stablecoin tokens with burnable, capped, allowlist and blocklist extensions. An Immunefi bounty covers the packages folder. — [GitHub API](https://github.com/OpenZeppelin/stellar-contracts), [Stellar docs](https://developers.stellar.org/docs/tools/openzeppelin-contracts), [Immunefi](https://immunefi.com/bug-bounty/openzeppelin-stellar/scope/). OpenZeppelin/contracts-wizard (295 stars, multi-chain) is the generator; I did not check whether it covers Stellar.
- stellar/soroban-examples (147 stars, active), stellar/soroban-test-examples (1 star), stellar/actions (4 stars, GitHub Actions for Stellar repos), stellar/quickstart (224 stars). stellar/soroban-template-astro is archived (6 stars, last push 2025-01-16). stellar/soroban-example-dapp archived (1454 stars, last push 2026-01-08). — [GitHub API](https://github.com/stellar/soroban-examples)
- Scaffold-style community repos are tiny: Soro-Bix/soroban-scaffold (3 stars), thefifthdev/stellarforge (2 stars), stellar-builders/stellar-dev-kit (1 star), ScaffoldRust/ScaffoldRust-Tools (0 stars), soroban-forge-labs/soroban-forge (4 stars; scaffolding, test harness and CI), StellarDevTools/stellar-devkit (5 stars). I found no repo named scaffold-stellar under stellar/ via the API (404), so I can't confirm whether that official scaffold exists under another name.
- daccred/soroban-by-example: 127 stars, AI-assisted template generator and learning site, pushed 2026-08-28. — [GitHub](https://github.com/daccred/soroban-by-example)
- Reentrancy helpers: esteblock/reentrancy-soroban (2 stars, last push 2023-05-30, stale), williamedvard/aegis-middleware (0 stars, reentrancy guard and rate-limit middleware). — [GitHub search](https://github.com/search?q=soroban+reentrancy&type=repositories)

#### Source verification / attestation / reproducible builds
- **SEP-55** (Contract Build Verification): Draft, v0.4.1, created 2024-09-28, last updated 2025-03-12. A contract embeds `source_repo` (and optional `home_domain`) in `contractmetav0`; a GitHub Actions workflow produces an artifact attestation; a verifier checks hash, repo and commit. The SEP states it relies on trust in GitHub and does not prove the code is safe. — [SEP-55](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0055.md)
- **SEP-58** is the stricter standard: rebuild in a disposable Docker container from an OCI image and compare raw Wasm bytes to the deployed code, with a `source_sha256` in the metadata. Implemented by `@colibri/build-verification` (Deno, v0.x, MIT). — [JSR](https://jsr.io/@colibri/build-verification). I did not open the SEP-58 text.
- A Stellar Community Foundation submission says SEP-55 shows that a build ran from a repo but not that displayed source matches bytecode, and that the Stellar Lab source tab was removed for that reason. An SCF #44 proposal (The Aha Company with Runtime Verification) describes an on-chain registry of results from allow-listed verifiers. Treat it as a funding proposal; status unconfirmed. — [SCF submission](https://communityfund.stellar.org/project/soroban-contract-source-verification-service-bax)
- stellar-expert/soroban-build-workflow: 6 stars, pushed 2026-10-04, GitHub workflow for building contracts (likely the SEP-55 route; not confirmed). — [GitHub](https://github.com/stellar-expert/soroban-build-workflow)
- New community verifiers (all 0-7 stars, 2026): soroverify/soroverify-verifier (7 stars, self-hostable, rebuilds in isolated containers), walnuthq/stellar-source-code-verification, fastaitop/soroban-source-verify, Stellar-Scan-app/stellar-scan-verify, shilpachittara/SourceProof, BreachDirect/sorseal (provenance plus scanner). — [GitHub](https://github.com/soroverify/soroverify-verifier)

#### Deployment / CI, wasm size, resource budget
- CI: Scout action (stale, 2025-05), Soroban-Guard/Actions, plumbline, ttl-doctor-action, persist-actions, Zakky-Fatty/soroban-actions (compile, test, optimize, simulate; 0 stars), ProtocolCanary-Action, stellar/actions. — [GitHub search](https://github.com/search?q=soroban+github+action&type=repositories)
- Wasm size: the only hit was lialamanroll/optima-profiler (0 stars, "fee and XDR optimization"). My search for a "soroban wasm optimizer" returned nothing else. `stellar contract optimize` is part of stellar-cli, but I did not fetch its docs to confirm.
- Resource budget regression: the budget/CPU-instruction benchmark search returned nothing. Tollcraft/soroban-cost-linter covers static cost anti-patterns, not measured regressions.
- Testing helpers: benelabs/crucible (17 stars), LockedTerminal/crucible (1 star), soroban-forge-io/soroban-forge (0 stars), Akinyemi04/soroban-test-kit (0 stars).

### Inferences
- Active, trustworthy tooling is concentrated in four vendors (CoinFabrik, Certora, Runtime Verification, OpenZeppelin) plus SDF repos. Everything else is under 3 months old and unproven. A TS tool should not assume these will be maintained.
- Scout's Soroban stack is slowing outside the main repo: the standalone scout-soroban repo and the GitHub Action are 11 and 17 months without commits. CI integration is therefore weak.
- Go, Kotlin and Swift typed contract-binding generators, a wasm-size/budget regression tool and a clippy-style lint set appear missing, based on search absence only (not proof).
- Source verification is fragmented between SEP-55 (a Draft since 2025-03), SEP-58, and many tiny verifiers, with no clear winner.

### Gaps
- I did not read code in any of the 2026 community repos; capabilities are from descriptions only.
- Could not confirm Sunbeam's license or repo location, Komet's current host-function coverage, or the current status of Almanax, DYET, Solarkraft or Extractor.
- Did not check awesome-soroban lists, Drips Wave issue lists, OtterSec or Veridise tool posts directly, or the Soroban Security Portal live site. GitHub search is the main source here, and it is rate-limited and ranks by stars, so very obscure repos may be missing.
- SEP-58 text, `stellar contract optimize`, and OpenZeppelin's Stellar wizard support were not verified.

## Which security-tool gaps are most painful (TTL/rent expiry, auth footguns, cross-contract reentrancy)?

### Takeaway
TTL/archival has the clearest gap: no established tool covers it and Scout has no detector for it. Only a cluster of 2026 repos with 0-11 stars attacks it. Auth and arithmetic issues are partially covered by Scout. Reentrancy is contested and not well covered by detectors.

### Cited Findings
- Veridise identifies state archival as a bug source: persistent entries can be evicted and restored, so contracts must handle absent state. — [Veridise](https://veridise.com/blog/learn-blockchain/how-is-stellar-funding-smart-contract-security-at-scale/)
- Certora's guide tells developers to check authorization, overflow, rounding, error handling and storage key collisions. — [Certora blog](https://www.certora.com/blog/roadmap-to-a-soroban-security-audit)
- Veridise's 2025 Soroban Core report has findings titled "ledger entries being deleted arbitrarily", "denial of service during authorization" and "signature replay attacks"; only the table of contents was seen, so details and severity are unconfirmed. — [Veridise report](https://veridise.com/wp-content/uploads/2025/02/VAR_Stellar_Soroban.pdf)
- One source claims reentrancy of the EVM kind is not possible on Stellar by design. That is a single source I did not verify; I would not treat it as settled. — [Veridise](https://veridise.com/blog/learn-blockchain/how-is-stellar-funding-smart-contract-security-at-scale/)
- Recent audit data points: RV's audit of soroban-env (Dec 2024) found no critical/high and one medium; Halborn's Apr-May 2026 Templar Soroban Vault assessment found 4 high and 22 medium, all addressed (bug classes not shown in the snippet). — [RV](https://runtimeverification.com/public-report/soroban-env), [Halborn](https://www.halborn.com/audits/templar-protocol/smart-contract-assessment-0669c5)
- The new TTL tools are a mix of off-chain keepers (archguard, ledgerkeep, sorokeep, ttl-guardian), static analysis (persist-core, ttl-doctor) and monitoring (sorolens). No tool with more than 11 stars. — [GitHub search](https://github.com/search?q=soroban+ttl&type=repositories)

### Inferences
- Pain ranking (my judgment): 1) TTL/archival bugs, where tooling is thinnest and the failure is silent until state expires; 2) auth footguns such as unprotected upgrade or `require_auth` omissions, partly covered by Scout detectors; 3) upgrade/storage-layout breaks, only addressed by 2026 micro-tools; 4) cross-contract reentrancy/ordering, which lacks specific detectors, though its risk level is disputed.
- A static checker cannot see the live TTL values. An RPC-aware tool (reading ledger entries and live TTLs) is better placed than a source linter for finding entries near expiry.

### Gaps
- No quantitative data on how often TTL bugs appear in audits. The Soroban Security Portal likely holds this, but I could not query it.

## Which gaps could a TypeScript SDK/CLI/web dashboard focused on RPC reliability, simulation and error decoding fill?

### Takeaway
Live-state tools fit TypeScript well: TTL watching, simulation diffing and error decoding. I found few dedicated, popular tools in these areas and some of the new ones are in TS. Static analysis, formal verification and wasm tooling are better left to Rust.

### Cited Findings
- Existing TS-adjacent live-state projects, all small: archguard-app (TS monorepo with dashboard, 11 stars), soroban-ttl-guardian (TS, 0 stars), sorolens (10 stars), Raveu-lab/soroban-devkit-cli and soroban-devkit-core ("simulate calls, decode XDR events", 0 stars, 2026-10-07), Hollujay/simutrace (browser tool showing state before/after a simulated call, 1 star), sorotrail/SoroTrail and SoroBeacon (event indexing beyond RPC retention and alerting, 2 and 1 stars), soroban-forge-labs/soroban-lens (event indexer and explorer, 5 stars). — [GitHub search](https://github.com/search?q=soroban+simulate+transaction&type=repositories)
- Searches for "soroban error decoder diagnostic events" and "stellar rpc client reliability" returned no repos. — GitHub search, 2026-10-08
- The official stellar-rpc has 59 stars and is active (pushed 2026-10-08); the official RPC retains only a limited event/ledger window (SoroTrail's description says it stores events "durably past the RPC's" retention). — [GitHub](https://github.com/stellar/stellar-rpc), [SoroTrail](https://github.com/sorotrail/SoroTrail)
- soroauth/soroauth-go builds and inspects authorization entries (Go); I found no TS equivalent in my searches. — [GitHub](https://github.com/soroauth/soroauth-go)
- Resource-budget regression and fee/instruction tracking found no established tool (see section 1).

### Inferences
- Plausible TS niches (my judgment, not validated demand): (a) RPC failover/retry client with simulation-based preflight; (b) human-readable decoding of contract errors, diagnostic events and auth-entry failures; (c) CI action that simulates against a fork or testnet and fails on CPU/memory/fee or footprint regressions; (d) TTL dashboard reading live ledger entries and flagging near-expiry entries; (e) upgrade diff that uses the on-chain spec plus simulation.
- Crowding risk: TTL monitoring is already attempted by about 8 new repos; error decoding and budget regression appear emptier.

### Gaps
- Did not research the official SDK's own error handling, or which RPC providers are unreliable. That belongs to other researchers' scope.
- No developer-demand evidence (forum threads, Drips Wave issue lists) was gathered.
