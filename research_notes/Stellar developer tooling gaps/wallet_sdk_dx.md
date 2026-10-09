# Stellar wallet, SDK, client-library and DX tooling (as of 2026-10-08)

Method note: star counts and last-push dates come from the GitHub API (`gh api repos/...`, `gh search repos`) queried on 2026-10-08. "Stale" means no push in more than 12 months, i.e. before about Oct 2025. GitHub search rate-limited or returned nothing for several later queries (VS Code, scaffold, multisig apps, fee-bump tooling). Coverage of those areas is therefore thin, and I say so in the Gaps sections. Issue-tracker pain-point evidence is also thin: I confirmed only a few issues, so treat that section as indicative, not comprehensive.

## 1. Official and major community SDKs: status and gaps

### Takeaway
The core JS, Rust, Python, Java and mobile SDKs are all actively pushed (within days of 2026-10-08). The notable churn is that the Go SDK moved to a new repo and the Soroban-specific JS client was folded into js-stellar-sdk. The .NET and Ruby community SDKs are stale or archived, and the Kotlin wallet SDK is archived.

### Cited Findings
- js-stellar-sdk: 694 stars, last push 2026-10-07, active — [GitHub](https://github.com/stellar/js-stellar-sdk)
- rs-soroban-sdk (contract SDK): 206 stars, last push 2026-10-08, active — [GitHub](https://github.com/stellar/rs-soroban-sdk)
- Go: `stellar/go` is archived (last push 2025-12-10). The active repo is `stellar/go-stellar-sdk` (1,383 stars, push 2026-10-07) — [archived](https://github.com/stellar/go), [new](https://github.com/stellar/go-stellar-sdk)
- Python py-stellar-base (StellarCN/py-stellar-base): 368 stars, push 2026-09-29, active — [GitHub](https://github.com/StellarCN/py-stellar-base)
- Java: lightsail-network/java-stellar-sdk, 202 stars, push 2026-09-23, active. The path `stellar/java-stellar-sdk` returned 404, so it is a community-maintained repo — [GitHub](https://github.com/lightsail-network/java-stellar-sdk)
- Swift: Soneso/stellar-ios-mac-sdk, 132 stars, push 2026-10-07, active — [GitHub](https://github.com/Soneso/stellar-ios-mac-sdk)
- Flutter/Dart: Soneso/stellar_flutter_sdk, 88 stars, push 2026-10-07, active — [GitHub](https://github.com/Soneso/stellar_flutter_sdk)
- Ruby: astroband/ruby-stellar-sdk, 73 stars, last push 2025-01-28. Stale (about 20 months) — [GitHub](https://github.com/astroband/ruby-stellar-sdk)
- C#/.NET: elucidsoft/dotnet-stellar-sdk, 115 stars, archived, last push 2024-05-24, targets .NET 6 — [GitHub](https://github.com/elucidsoft/dotnet-stellar-sdk)
- Legacy Soroban JS client stellar/js-soroban-client: archived, last push 2024-07-22 — [GitHub](https://github.com/stellar/js-soroban-client)
- Kotlin Wallet SDK stellar/kotlin-wallet-sdk: 7 stars, archived, last push 2026-07-01 — [GitHub](https://github.com/stellar/kotlin-wallet-sdk)
- TypeScript Wallet SDK (stellar/typescript-wallet-sdk): 34 stars, push 2026-10-07, active. Covers SEP flows for wallets — [GitHub](https://github.com/stellar/typescript-wallet-sdk)
- stellar-cli: 123 stars, push 2026-10-07, active — [GitHub](https://github.com/stellar/stellar-cli)
- stellar-xdr definitions: 32 stars, push 2026-10-07 — [GitHub](https://github.com/stellar/stellar-xdr)
- quickstart (local network Docker image): 224 stars, push 2026-10-06 — [GitHub](https://github.com/stellar/quickstart)
- soroban-examples: 147 stars, push 2026-10-06 — [GitHub](https://github.com/stellar/soroban-examples)
- OpenZeppelin stellar-contracts: 97 stars, push 2026-10-07 — [GitHub](https://github.com/OpenZeppelin/stellar-contracts)
- A Kotlin Multiplatform SDK for OpenZeppelin smart accounts exists (passkey wallets, signer management, context rules, policies). I did not locate its repo URL — [search snippet via passkey-kit README listing](https://github.com/kalepail/passkey-kit)

### Inferences
- PHP, Kotlin (core, non-wallet) and C# repos did not resolve under guessed org paths (404). I could not verify their status. The Soneso PHP and KMP SDKs likely exist but were not confirmed.
- Ruby and .NET are the clear stale spots. A TypeScript-only decoding library would not help those ecosystems directly, but a language-neutral error catalog (JSON) could.

### Gaps
- PHP, Kotlin core SDK, and other language SDK stats not verified (guessed URLs returned 404 and search was rate-limited).
- No check of each SDK's coverage of Soroban features (simulate/assemble, auth entries) per language.

## 2. Wallets, wallet kits and smart-wallet tooling

### Takeaway
Wallet connectivity is well covered by Stellar Wallets Kit (many wallets behind one API). The passkey/smart-wallet stack was recently consolidated under the `stellar` GitHub org, with the two incompatible kits (passkey-kit vs smart-account-kit) as the main source of confusion.

### Cited Findings
- Stellar Wallets Kit (Creit-Tech): 80 stars, push 2026-10-07, active. Handles wallet connection and signing only, UI left to developer. Supported wallets listed in Stellar docs: Albedo, Freighter, Hana, Ledger, Trezor, Lobstr, Rabet, WalletConnect, xBull, HOT Wallet — [GitHub](https://github.com/Creit-Tech/Stellar-Wallets-Kit), [JSR](https://jsr.io/@creit-tech/stellar-wallets-kit), [Stellar docs](https://developers.stellar.org/docs/tools/developer-tools/wallets)
- Package naming and API changed: older guides use `@creit.tech/stellar-wallets-kit` with a constructor API; JSR v2.6.0 uses `@creit-tech/stellar-wallets-kit` with an `init`-style API — [JSR README](https://jsr.io/@creit-tech/stellar-wallets-kit/2.6.0/README.md), [Trustless Work guide](https://docs.trustlesswork.com/trustless-work/developer-resources/stellar-wallet-kit-quick-integration)
- Freighter: 118 stars, push 2026-10-07, active — [GitHub](https://github.com/stellar/freighter)
- Rabet extension: 632 stars, last push 2025-12-23 (about 9.5 months, near stale) — [GitHub](https://github.com/rabetofficial/rabet-extension)
- xBull Wallet (Creit-Tech/xBull-Wallet): 32 stars, last push 2025-08-13, stale (about 14 months) — [GitHub](https://github.com/Creit-Tech/xBull-Wallet)
- passkey-kit: originally kalepail/passkey-kit (501 stars, archived, pointer to move). Now stellar/passkey-kit, 3 stars, push 2026-09-18. README warns to review the contract and SDK before holding value. Uses a flat Signatures map; submits via a relayer (fee sponsorship) — [old](https://github.com/kalepail/passkey-kit), [new](https://github.com/stellar/passkey-kit)
- smart-account-kit: now stellar/smart-account-kit, 5 stars, push 2026-09-18. Built on the audited OpenZeppelin account contract with context rules and policies. Not drop-in compatible with passkey-kit — [GitHub](https://github.com/stellar/smart-account-kit)
- OpenZeppelin relayer channels plugin: 4 stars, push 2026-10-05; the successor path to Launchtube-style fee-sponsored submission (my reading, not a stated fact in the repo; description is null) — [GitHub](https://github.com/OpenZeppelin/relayer-plugin-channels)
- Albedo and Lobstr repos: not checked directly (guessed URLs 404).

### Inferences
- Two smart-wallet SDKs with different auth models plus a repo migration (kalepail to stellar org) is a real discoverability and error-handling problem; stale links and package names appear in tutorials.
- Wallet-kit API break between versions suggests a compatibility shim or migration-linting opportunity.

### Gaps
- Albedo, Lobstr, Hana, HOT wallet repos and stars not verified.
- Launchtube status (deprecated or not) not confirmed in this pass.
- Fee-bump and sponsorship standalone tooling: no dedicated repos found; search returned nothing.

## 3. SEP, anchor and testing tooling

### Takeaway
Anchor Platform and the official anchor test suite are active, but community SEP repos are small and many are stale. A TypeScript SEP-10 client in the community (satoshipay) is stale since 2023.

### Cited Findings
- stellar/anchor-platform: 60 stars, push 2026-10-08, active. (Repo description says "Java SDK for the Stellar network anchor development".) — [GitHub](https://github.com/stellar/anchor-platform)
- stellar-anchor-tests (library and CLI for testing anchors): 17 stars, push 2026-09-16 — [GitHub](https://github.com/stellar/stellar-anchor-tests)
- Stellar Disbursement Platform backend: 62 stars, push 2026-10-05 — [GitHub](https://github.com/stellar/stellar-disbursement-platform-backend)
- satoshipay/stellar-sep-10 (SEP-10 client): 3 stars, last push 2023-01-04, stale — [GitHub](https://github.com/satoshipay/stellar-sep-10)
- alcalawil/stellar-anchor (TypeScript anchor, SEP-10/06): 1 star, last push 2022-09-21, stale — [GitHub](https://github.com/alcalawil/stellar-anchor)
- Obscure and recent: 0dillon/Anchorage (Go SEP-10 server, 3 stars, 2026-08-18); abore9769/SorobanAnchor (Soroban contract SDK for SEP-6/10 anchors, 1 star, 2026-09-30); mergepay/mergepay-api (18 stars, SEP-10/24, 2026-10-07) — [Anchorage](https://github.com/0dillon/Anchorage), [SorobanAnchor](https://github.com/abore9769/SorobanAnchor), [mergepay](https://github.com/mergepay/mergepay-api)

### Inferences
- No SEP-31/12 specific community tooling surfaced; likely under-served but unverified.

### Gaps
- anchor-validator specifics, SEP-24 UI test tools, SEP-6/12 repos not exhaustively searched.

## 4. Debugging, error decoding, multisig, faucets, IDE and AI tooling

### Takeaway
A few new error-decoding and debugging tools exist but are tiny (0 to 9 stars). Official Stellar Laboratory covers XDR and simulation in a browser, but no IDE extension, language server, or high-quality multisig coordinator surfaced. AI/MCP tooling is nascent: one official-adjacent MCP (stellar-raven) plus several hobby servers.

### Cited Findings
- Prism (Toolbox-Lab/Prism, formerly Synk-Lab): "Soroban transaction debugger", 9 stars, push 2026-10-03. A listing says it decodes Soroban host errors into plain English with suggested fixes — [GitHub](https://github.com/Toolbox-Lab/Prism), [search listing](https://github.com/Synk-Lab/Prism)
- Absolutelyeomary/soroban-error-decoder: 0 stars, push 2026-05-06; decodes XDR, numeric codes and RPC responses to plain language — [GitHub](https://github.com/Absolutelyeomary/soroban-error-decoder)
- Colibri core (@colibri/core on JSR, v0.23-0.25) has a ParsedSimulationContractError type whose code source is "diagnostic-event" or "simulation-error-string", with matchingEventIndexes for correlating events — [JSR](https://jsr.io/@colibri/core@0.23.0/doc/~/ParsedSimulationContractError)
- CarmineOptions/stellar-xdr-decoder: 0 stars, last push 2023-11-29, stale — [GitHub](https://github.com/CarmineOptions/stellar-xdr-decoder)
- Stellar Laboratory: 112 stars, push 2026-10-03, active — [GitHub](https://github.com/stellar/laboratory)
- StellarExpert explorer: 81 stars, push 2026-09-19 — [GitHub](https://github.com/stellar-expert/stellar-expert-explorer)
- Multisig: overcat/stellar-multisig-coordinator, 1 star, last push 2019-12-16, stale — [GitHub](https://github.com/overcat/stellar-multisig-coordinator)
- Faucets: yivo/stellar-testnet-faucet (2019, stale); newer hobby ones with 0 stars (FaucetX 2026-08, StellarDripz 2026-09, jasamansinghchaggar/stellar-faucet 2026-04). Friendbot is the standard but not re-verified here — [yivo](https://github.com/yivo/stellar-testnet-faucet), [StellarDripz](https://github.com/Stellar-Richpay/StellarDripz)
- MCP: stellar-experimental/stellar-raven (9 stars, push 2026-10-08; docs, ecosystem data and playbooks gateway, authenticated); kalepail/stellar-mcp-server (4 stars, last push 2025-05-15, stale); grandmastr/chronos-mcp (0 stars, last push 2025-06-02, stale); stellar-x402-mcp/monorepo (3 stars, 2026-09-16, x402 payments) — [raven](https://github.com/stellar-experimental/stellar-raven), [kalepail](https://github.com/kalepail/stellar-mcp-server), [chronos](https://github.com/grandmastr/chronos-mcp), [x402](https://github.com/stellar-x402-mcp/monorepo)
- Glama lists other Stellar MCPs (account/network tools incl. XDR parsing, OpenZeppelin contract generation, Privy wallets); not opened — [Glama](https://images.glama.ai/mcp/servers/integrations/stellar)
- Stellar publishes agent "skills" at skills.stellar.org (dapp skill seen) — [skills.stellar.org](https://skills.stellar.org/skills/dapp/SKILL.md)
- VS Code / language server for Soroban: searches ("soroban vscode extension", "soroban language server") returned zero GitHub repos. Not found; marketplace itself was not checked.

### Inferences
- Error decoding is crowded at the hobby level but fragmented: none are widely adopted, none have more than 9 stars. A maintained, SDK-integrated decoder is a gap-fit.
- IDE/language-server tooling appears absent from GitHub (marketplace unchecked).

### Gaps
- VS Code Marketplace and npm searches not performed.
- Multisig coordinators beyond a 2019 repo: not found; Laboratory's own multisig features not assessed.

## 5. DX pain points in issues and forums

### Takeaway
Evidence gathered is limited but consistent: error messages from simulation are opaque strings, diagnostic output is lost on failure, and XDR errors are unhelpful.

### Cited Findings
- stellar-cli issue: "doesn't output diagnostic logs received from submitting tx that fails" (open) — [stellar-cli#1089](https://github.com/stellar/stellar-cli/issues/1089)
- rs-soroban-sdk issue: an "xdr processing error: xdr value invalid" appeared when an example was slightly modified — [rs-soroban-sdk#1276](https://github.com/stellar/rs-soroban-sdk/issues/1276)
- js-stellar-sdk simulation response is a union of success, restore (expired/archived state needs restore) and an error type containing a raw error string plus events — [SDK docs index](https://docsearch.algolia.com/mcp/docs/repo/stellar/js-stellar-sdk)
- Colibri's design (parse error code from diagnostic events or simulation error string) shows the code is not in a structured field in the SDK response — [JSR](https://jsr.io/@colibri/core@0.23.0/doc/~/ParsedSimulationContractError)

### Inferences
- Pain themes (opaque HostError strings, restore-vs-error ambiguity, XDR decode errors, diagnostic events not surfaced) are the exact space a TypeScript SDK that decodes errors and simulates Soroban transactions would target.
- Best-fit adjacent gaps: (a) structured error decoder mapping contract error codes to names from contract spec; (b) simulation wrapper that classifies restore/auth/resource/contract errors and suggests fixes; (c) auth-entry inspector and signing helper; (d) MCP/agent skill exposing decode and simulate as tools; (e) language-neutral error catalog for stale-SDK ecosystems (Ruby, .NET); (f) VS Code extension or language server (appears unclaimed).

### Gaps
- No systematic counts of issues by theme (search tool failed or rate-limited); auth-entry and footprint/resource-limit issue evidence not collected.
- Stellar dev forum and Discord not searched.
- SCF award lists not reviewed, so overlap with funded projects is unknown.
