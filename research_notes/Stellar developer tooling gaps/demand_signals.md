# Demand signals: unmet Stellar/Soroban developer tooling needs (as of Oct 2026)

Method note: fetch tools could not show GitHub reaction counts (pages are sorted by thumbs-up but counts are not rendered), and could not reach Stack Exchange API, Reddit, Discord, the Stellar dev forum, or the Stellar Developer Survey. Rankings below are therefore by *convergence of independent signals* (GitHub sort position, funded SCF proposals, official docs), not by raw mention counts. Where I could not source a count, it is listed under Gaps. GitHub "sorted by reactions" order was retrieved around Oct 2026.

## Top recurring unmet needs (evidence-ranked)

### Takeaway
Strongest signals: (1) debugging/tracing of failed Soroban transactions, (2) contract source/build verification, (3) CLI/SDK bindings and codegen churn, (4) fork/mainnet-state testing, (5) ops tooling (relayer/monitor), plus RPC data-access ergonomics (historical state, event ordering, resource metrics). SCF paid $150K for a Soroban debugger in round #41, the clearest "funders pay for it" signal found.

### Cited Findings
Ranked list (rank = number/strength of independent signals):

1. **Step-through / WASM-level debugger and failed-tx diagnosis.** SCF #41 awarded $150K (Developer Tooling, Build track) to Runtime Verification's "Advanced Debugging for Soroban Contracts" (local testnet node, DAP server, VS Code/Cursor); problem statement: no integrated debugger showing WASM-level execution and host interactions — [SCF submission](https://communityfund.stellar.org/submissions/recDYQJ63TqlNBacf). Another proposal says mainnet failures give only generic XDR errors, devs rely on simulation and logs for partial visibility; Erst (replay tool) is pre-alpha — [Hintents/Erst docs](https://www.mintlify.com/dotandev/hintents). Related RPC issue "Return the memory consumed in simulation response" (#477) ranks #2 by reactions in stellar-rpc — [stellar-rpc issues](https://github.com/stellar/stellar-rpc/issues/477). CLI issue "add replay command to introspect diagnostic events" (#1027) is top-10 by reactions — [stellar-cli #1027](https://github.com/stellar/stellar-cli/issues/1027). Official docs: `Budget, LimitExceeded` is the common failure and diagnosis requires reading diagnostic events — [Stellar docs](https://developers.stellar.org/docs/learn/fundamentals/contract-development/errors-and-debugging/debugging-errors).
2. **Contract source/build verification (Etherscan-style).** SEP-55 attestations prove a build ran from a repo, not that displayed source matches on-chain bytecode; this led to removal of the Stellar Lab source tab; SCF #44 "Verified Stellar Sources" (The Aha Company + Runtime Verification) proposes an on-chain verifier hub — [SCF submission](https://communityfund.stellar.org/dashboard/submissions/receWOpMjj7FxAydj). SEP-58 + `@colibri/build-verification` rebuilds Wasm in Docker and compares bytes — [JSR package](https://jsr.io/@colibri/build-verification). Explorer proposals cite need for contract-introspecting explorers — [SCF submission](https://communityfund.stellar.org/submissions/recsNbuj56ko8dhE6).
3. **Reliable TypeScript bindings/codegen.** stellar-cli #2758 (opened Sep 26, 2026; top of cli by reactions): `bindings typescript` deprecated in CLI 28.1.0 before replacement plugin was released in SDK 17.1.0; plugin ignores CLI config and rejects `--network local` — [stellar-cli #2758](https://github.com/stellar/stellar-cli/issues/2758). js-stellar-sdk #1755 "bindings plugin parity" is top-5 by reactions — [js-stellar-sdk issues](https://github.com/stellar/js-stellar-sdk/issues/1755).
4. **Fork testing against live state.** Official fork testing via `stellar snapshot create` + `Env::from_ledger_snapshot_file`; guide notes no details on snapshot scale/refresh — [Stellar docs](https://developers.stellar.org/docs/build/guides/testing/fork-testing). Third-party `soroban-fork` crate positions itself as "Anvil for Soroban" with lazy RPC loading — [docs.rs](https://docs.rs/soroban-fork). Existence of a third-party clone signals official gap (lazy-loading, persistent fork node).
5. **Smart-account / account-abstraction tooling.** stellar-cli #2762 "Smart Account Support" in top-10 by reactions — [stellar-cli #2762](https://github.com/stellar/stellar-cli/issues/2762). Ledger-device signing for `contract invoke` (#1872, labeled stale) also top-10 — [stellar-cli #1872](https://github.com/stellar/stellar-cli/issues/1872). Protocol 27 CAP-71 auth delegation increases this need (see Q3).
6. **Historical state / RPC data access.** stellar-rpc #375 "Serve recent historical state" is #1 by reactions; #188 HTTP endpoints for RPC; #575 `order` param for getEvents (descending); #552 flat topic filter — [stellar-rpc issues](https://github.com/stellar/stellar-rpc/issues/375). Funded counterpart: SCF #40 RPC/indexing infrastructure proposal to eliminate vendor fragmentation (per search summary) — [SCF search result](https://communityfund.stellar.org/awards).
7. **CLI state-archival ergonomics (TTL bump/restore).** stellar-cli #790 reorganize bump/restore (top-2) and #809 `--ledgers-to-expire` flag — [stellar-cli issues](https://github.com/stellar/stellar-cli/issues/790). CAP-78 (v2 TTL functions) shipped in Protocol 26 — [P26 guide](https://stellar.org/blog/foundation-news/stellar-yardstick-protocol-26-upgrade-guide).
8. **Read-only simulate invoke & better fee/balance error messages in CLI.** #221 simulate-only invoke; #2142 show balance/needed amount on insufficient-balance deploy failure — [stellar-cli issues](https://github.com/stellar/stellar-cli/issues/221).
9. **Local network ergonomics.** #1701 `network-container-start` should await healthy network — [stellar-cli #1701](https://github.com/stellar/stellar-cli/issues/1701).
10. **Fragmented workflow / unified IDE tooling.** Proposed VS Code extension argues devs juggle Lab, CLI, RunKit, Postman, curl — [SCF submission](https://communityfund.stellar.org/submissions/recpomNZXKFtufheP) (via search summary; page not fetched).
11. **JS SDK correctness/DX gaps.** Util for parsing `getTransaction` (#1091), `Memo.id` rejects bigint (#1647), `requestAirdrop` can't detect funded account (#1645), `scvSortedMap` invalid order for composite keys (#1636), timestamps typed `number` (#1644), modularize SEP code (#663) — [js-stellar-sdk issues](https://github.com/stellar/js-stellar-sdk/issues/1091).
12. **Missing reference examples.** soroban-examples top asks: single-signer account example (#226), DAO (#168), ZK rollup (#169), bridge connector (#167), smart token (#147), liqpool rewrite (#246) — [soroban-examples issues](https://github.com/stellar/soroban-examples/issues/226).
13. **Contract ops: relaying, monitoring, sequence-number bottleneck.** OpenZeppelin shipped open-source Relayer + Monitor (alpha for Stellar), hosted Stellar Relayer (Mar 24, 2026) with Channels plugin to avoid sequence-number bottlenecks, and Security Detectors SDK; Defender being sunset — [OpenZeppelin news](https://www.openzeppelin.com/news/expanding-stellar-support-with-relayer-service), [Monitor/Relayers OSS](https://www.openzeppelin.com/news/monitor-and-relayers-are-now-open-source). (Partly filled; maturity unverified.)
14. **ZK developer tooling.** Docs state Protocol 25 primitives are building blocks without end-to-end private payments — [ZK docs](https://developers.stellar.org/docs/build/apps/zk). Confidential Tokens developer preview (testnet only, June 29) uses Noir + UltraHonk verifier — [Nansen Q2 2026](https://nansen.ai/post/stellar-q2-2026-report).
15. **Security/static analysis & fuzzing.** Official fork guide mentions fuzzing possible but no detail — [Stellar docs](https://developers.stellar.org/docs/build/guides/testing/fork-testing); Meridian session on fuzzing Soroban — [Meridian](https://meridian.stellar.org/sessions/how-to-test-rust-smart-contracts-on-soroban). Evidence thin (see Gaps).

What funders pay for:
- SCF 6.0 tracks: Kickstart (up to $15K), Build Award (up to $150K in tranches), Growth, Delegate Panels; no explicit tooling category in the post — [SCF v6 blog](https://stellar.org/blog/developers/introducing-stellar-community-fund-v6-0).
- SCF 7.0 (Jan 2026): three Build Award tracks (Open, Integration, RFP per awards page), AI prescreening, referrals with incentives, milestone tranches — [SCF v7 blog](https://stellar.org/blog/ecosystem/introducing-scf-v7), [awards page](https://communityfund.stellar.org/awards) (504 awarded submissions, SCF #1-#46).
- Awards pages list "Developer Tooling" as a category under Build (e.g., SCF #41 RV debugger $150K) — [SCF submission](https://communityfund.stellar.org/submissions/recDYQJ63TqlNBacf).
- Drips Wave: monthly week-long bounty cycles, Stellar flagship partner since Jan 21, 2026; ~600 participants merged 3,000+ PRs across 200+ repos in first ten days; 30,000+ PRs merged in Stellar Wave Program per Drips Q1 2026 — [Drips docs](https://docs.drips.network/wave), [Radworks Q1 update](https://community.radworks.org/t/drips-org-q1-2026-update/3721). Maintainers choose issues, so Wave surfaces maintainer backlog, not independent developer demand.

### Inferences
- Debugging + verification are the best-evidenced gaps: they combine a $150K award, a second funded proposal (#44), and open-issue demand.
- Gaps that already have multiple funded entrants (debugger, verifier) are crowded; unfilled niches: tx-trace UI over RPC, fork node (persistent), gas/resource profiler, smart-account CLI tooling.
- Drips Wave figures are volume of PRs, not evidence of demand for any tool.

### Gaps
- No reaction counts retrievable (GitHub pages hide them); could not confirm counts for any issue above.
- Stellar Developer Survey, State of Soroban report, Reddit r/Stellar, Discord, dev forum, stellar-dev discussions, Stack Overflow `soroban` tag counts: not retrieved (search returned nothing relevant / API blocked). I found no Soroban-specific survey.
- SCF RFP list for Infrastructure & Tooling in 2026 not found; awards page lacks per-project data without drilling into round pages.
- Items 10 and the SCF #40 claim rest on search-result summaries, not fetched pages.

## Ethereum/Solana tools with no (or weak) Stellar equivalent: borrowable-idea gap list

### Takeaway
Fork testing and verification partially exist; a Tenderly-grade simulator/debugger/alerting suite, Hardhat-style network forking node, and Dune-style analytics lack clear, mature Stellar equivalents in what I found. Defender-like ops now exists via OpenZeppelin (alpha/hosted).

### Cited Findings
- Tenderly-like simulator/debugger: only funded/early efforts (RV debugger SCF #41, Erst pre-alpha) — [SCF](https://communityfund.stellar.org/submissions/recDYQJ63TqlNBacf), [Erst](https://www.mintlify.com/dotandev/hintents). I found no evidence Tenderly supports Stellar (search returned only EVM docs) — [Tenderly docs](https://docs.tenderly.co/forks/guides/testing).
- Foundry/Anvil-like fork: official snapshot-based fork test exists; Anvil-style lazy fork is a third-party crate — [Stellar docs](https://developers.stellar.org/docs/build/guides/testing/fork-testing), [soroban-fork](https://docs.rs/soroban-fork). Sui community is discussing Foundry-style fork tests too, showing it's a cross-chain gap — [Sui forum](https://forums.sui.io/t/enabling-foundry-esque-fork-tests-on-sui/44946). Flow has official fork testing in CLI — [Flow docs](https://developers.flow.com/build/tools/flow-cli/fork-testing).
- Hardhat: Stellar docs frame Hardhat as EVM-only and provide a migration guide — [Stellar docs](https://developers.stellar.org/docs/learn/migrate/evm/smart-contract-deployment).
- Etherscan verify: SEP-55/SEP-58 and Colibri exist but trust gap unresolved; SCF #44 targets it — [SCF #44](https://communityfund.stellar.org/dashboard/submissions/receWOpMjj7FxAydj).
- OpenZeppelin Defender: Defender sunset; OZ Relayer/Monitor open source with Stellar support — [OZ](https://www.openzeppelin.com/news/monitor-and-relayers-are-now-open-source).

### Inferences
- Stellar-specific stateful differences (sequence numbers, TTL/archival, auth entries, footprints) mean ports must be redesigned, not cloned: e.g., a "footprint/resource profiler" and "TTL monitor/auto-bump service" are Stellar-native analogues with no equivalent found.
- Not investigated: Dune-like analytics, Helius-like webhooks/enhanced APIs, Anchor-like IDL framework, NEAR/Sui specifics.

### Gaps
- No searched coverage of Dune/analytics, Helius, Anchor, NEAR, Sui tooling versus Stellar equivalents (Stellar Expert, Galexie/Hubble, Mercury, etc. not verified).

## Upcoming (2026) protocol changes that create tooling gaps

### Takeaway
Protocols 25-27 add ZK primitives, state-freeze, TTL control, and auth delegation; each needs new debugging, SDK, and testing tooling. P25 and P26 are live; P27 status unconfirmed.

### Cited Findings
- Protocol 25 "X-Ray" mainnet Jan 22, 2026: CAP-74 BN254 (G1 add/mul, multi-pairing) and CAP-75 Poseidon/Poseidon2 — [Stellar blog](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25), [software versions](https://developers.stellar.org/docs/networks/software-versions). Numbering caveat: a BN254 item also appears as CAP-80 in P26.
- Protocol 26 "Yardstick" mainnet vote May 6, 2026: CAP-77 frozen ledger keys; CAP-82 checked 256-bit arithmetic; CAP-78 TTL v2; CAP-80 nine BN254 host functions; CAP-73 SAC trustline creation; CAP-79 muxed strkey conversion — [SDF guide](https://stellar.org/blog/foundation-news/stellar-yardstick-protocol-26-upgrade-guide). CAP-81 (eviction scan from in-memory state) per [Apr 16 meeting](https://developers.stellar.org/meetings/2026/04/16) (via search summary).
- Protocol 27 "Zipper": testnet June 18, CAP-71 authentication delegation and address-bound credentials; mainnet vote scheduled July 8; outcome not confirmed in source dated Aug 5 — [Nansen](https://nansen.ai/post/stellar-q2-2026-report).
- Quantum Preparedness Plan (June 9): Stage 1 (2026) post-quantum verification in Soroban contracts; Stage 2 (2027) protocol-level — [Nansen](https://nansen.ai/post/stellar-q2-2026-report).
- Confidential Tokens preview (testnet, June 29) — [Nansen](https://nansen.ai/post/stellar-q2-2026-report).

### Inferences
- CAP-77 freeze: wallets/explorers/simulators need "frozen key" awareness and clearer failure reasons.
- CAP-71 + smart accounts: need auth-entry inspectors, smart-account CLI (cf. stellar-cli #2762), test harnesses for delegated auth.
- ZK (P25/26): need circuit-to-contract toolchains, proof/verifier-cost profilers (docs say primitives alone aren't end-to-end private payments).
- Post-quantum signers: SDK/wallet signer-management tooling.
- CAP-78/81: TTL-management and archival monitoring tools become more important.

### Gaps
- P27 mainnet outcome, any Protocol 28+ CAP list, and stellar-dev discussion threads not retrieved.
