# Stellar/Soroban data, indexing, events, monitoring and observability tooling (as of 2026-10-08)

Method note: GitHub stars and pushed dates were pulled live via `gh api` / `gh search` on 2026-10-08 (cited as GitHub). Doc claims come from developers.stellar.org fetches. Stale = no commits for more than 12 months (before about 2025-10). No repo found is stale except those flagged below.

## What are devs missing in RPC reliability/failover, retention-window access, event streaming, alerting?

### Takeaway
Stellar RPC keeps only about 7 days of data, has no push or subscription API, and documents no rate limits. Full history is reachable only through `getLedgers` backed by a data lake, not for events or transactions. Failover, health scoring, durable event storage and alerting are mostly left to the developer. The gaps are partly filled by small, very new (mostly 2026), low-star community repos.

### Cited Findings

#### Horizon vs RPC
- Horizon is "nearing end-of-life" and will be deprecated in favor of Stellar RPC and Portfolio APIs. It gets compatibility updates but no new features. No shutdown date is published — [Stellar APIs overview](https://developers.stellar.org/docs/data/apis); [Chainstack comparison](https://chainstack.com/learn/compare/top-6-stellar-rpc-providers-for-payments/)
- Allium rebuilt its Stellar datasets from RPC (v2) and asked users to switch by 10 July 2026. Its legacy effects and contract_events entities are deprecated — [Allium changelog](https://docs.allium.so/changelog/deprecated-stellar-v1)
- soroban-rpc was renamed stellar-rpc, and soroban-rpc packages and images are deprecated — [Stellar protocol 22 guide / search summary](https://stellar.org/blog/developers/protocol-22-upgrade-guide)
- The `stellar/go` repo, which holds the old Horizon code, is archived, last pushed 2025-12-10. Horizon now lives in `stellar/stellar-horizon` (9 stars, pushed 2026-10-06) — GitHub
- Chainstack says Horizon-model providers that have not adapted to RPC's bounded retention window "are already behind" — [Chainstack](https://chainstack.com/learn/compare/top-6-stellar-rpc-providers-for-payments/)

#### Retention window and historical access
- The default `history-retention-window` is 120960 ledgers, about 7 days. The operator can change it, and `getHealth` returns `ledgerRetentionWindow`, `oldestLedger` and `latestLedger`. Some older docs still say 24 hours — [getEvents docs](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)
- Retention is a ceiling, not a guarantee. Check `oldestLedger` on each provider — [Chainstack guide via search](https://chainstack.com/learn/how-to/how-to-get-stellar-rpc-endpoint/)
- "RPC infinite scroll" lets RPC serve any historical ledger from a Galexie or SEP-0054 data lake (S3 or GCS). Only `getLedgers` supports this. All other methods stay within the local window. Remote fetch is slower, the default timeout was raised, and egress costs apply. A full data lake is about 3.8 TB, growing about 0.5 TB/year. Self-hosting costs about $600 to bootstrap and about $160/month — [SDF blog](https://stellar.org/blog/developers/rpc-now-with-infinite-scroll). Another SDF doc estimates about 3 TB and about $1,100 for a full-history export — [Galexie full-history guide](https://developers.stellar.org/docs/data/indexers/build-your-own/galexie/admin_guide/full-history-exporting)
- A public read-only data lake exists at `s3://aws-public-blockchain/v1.1/stellar/ledgers/pubnet` (AWS Open Data) — [Galexie search summary](https://developers.stellar.org/docs/data/galexie)
- Galexie exports ledger metadata as compressed XDR to S3 or GCS and is the base of the Composable Data Pipeline. Repo `stellar/stellar-galexie`: 3 stars, pushed 2026-10-01 (GitHub). The BufferedStorageBackend docs mention only GCS support in places, which conflicts with the S3 and GCS claim elsewhere — [Galexie intro](https://stellar.org/blog/developers/introducing-galexie-efficiently-extract-and-store-stellar-data); [BufferedStorageBackend](https://developers.stellar.org/docs/data/indexers/build-your-own/ingest-sdk/developer_guide/ledgerbackends/bufferedstoragebackend)
- A full-history stellar-rpc is in development (`feature/full-history` branch, RocksDB hot tier plus packfile cold tier). Benchmarks are in `stellar-experimental/stellar-rpc-benchmarks`, created 2026-07-15, pushed 2026-09-10, 0 stars — GitHub; [README](https://github.com/stellar-experimental/stellar-rpc-benchmarks)

#### Event streaming
- `getEvents` limits: 5 filters per request, 5 contract IDs and 5 topic filters per filter, limit 1 to 10000 (default 100), cursor pagination. The docs describe polling and de-duplicating by event `id`. There is no websocket or subscription method, and the page covers no rate limits — [getEvents docs](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)
- The server aborts long requests with error -32001 after a default of 10 seconds — [getEvents search summary](https://developers.stellar.org/docs/data/apis/rpc/admin-guide/configuring)
- SDF's own event-ingestion guide recommends a cron job into your own DB, or a third-party indexer such as Mercury — [Ingest events guide](https://developers.stellar.org/docs/smart-contracts/guides/events/ingest)

#### Rate limits
- Stellar RPC and the SDF docs publish no rate limits. Provider limits are mostly undocumented in sources I found. Gateway.fm says authenticated requests get double the default limits but gives no numbers. OnFinality says its public endpoint is for development only and production needs an API key — [Gateway docs](https://docs.gateway.fm/rpc/stellar/); [OnFinality docs](https://documentation.onfinality.io/support/stellar)
- Blockdaemon has a documented rate-limiting page, but it is for Horizon — [Blockdaemon](https://docs.blockdaemon.com/docs/rate-limiting-for-stellar-horizon)

#### Alerting and account monitoring
- Alchemy offers a hosted Stellar Address Activity webhook covering XLM and classic asset transfers, DEX fills, liquidity pool activity and Soroban contract events. One webhook can track up to 100,000 addresses. It is closed and hosted — [Alchemy docs](https://www.alchemy.com/docs/reference/stellar-address-activity-webhook.md)
- Mercury advertises subscriptions and alerts — [Mercury via search](https://communityfund.stellar.org/project/mercury-2xt)
- OpenZeppelin Monitor (Rust) supports Stellar and notifies via Slack, Discord, email, Telegram, webhook and scripts. It has cron schedules, checkpoints and missed-block recovery — [OZ Monitor repo](https://github.com/OpenZeppelin/openzeppelin-monitor)
- Old Stellar account watchers are dead: `gosom/stellar-account-monitor` (last push 2019-03-31), `jonogreenz/stellar-webhooks` (2018) — GitHub

### Inferences
- The 7-day window plus the `getLedgers`-only archive means no official path to historical events or transactions on RPC. Devs must run their own indexer (or Mercury, SubQuery or Goldsky) from day one, otherwise they lose data. This is the largest structural gap.
- No push API means every consumer reinvents a polling loop with cursor, dedup and reorg handling, and a missed window (outage longer than 7 days, or a slow provider) can lose events permanently.
- Undocumented rate limits mean 429 handling is learned by trial. Dev tools should treat 429, `oldestLedger` drift and -32001 timeouts as first-class routing signals.

### Gaps
- Exact per-provider rate limits, pricing and real retention (as opposed to the nominal 7 days) were not found. Only SDF doc tables were available.
- No developer-complaint sources (forum, issues) were found about missing websockets. That is a doc-based inference only.
- I did not confirm whether Goldsky offers webhooks for Stellar. Goldsky docs list Mirror/Pipelines as the Stellar-supported product.

## Catalog: indexers, event decoders, data pipelines, providers

### Takeaway
Official building blocks (Galexie, Ingest SDK, Hubble, stellar-etl) are solid but low-level and Go or BigQuery centric. The commercial indexers (Mercury, SubQuery, Goldsky, Obsrvr) are hosted. The open-source TypeScript long tail is dominated by very new, 0 to 10 star repos, which signals demand without a standout, trusted solution.

### Cited Findings

#### Official and quasi-official
| Name | URL | Stars | Last push | Notes / limitations |
|---|---|---|---|---|
| stellar-rpc | https://github.com/stellar/stellar-rpc | 59 | 2026-10-08 | Active. Exposes Prometheus `/metrics` on the admin endpoint and `getHealth`. 7-day window. Per-ledger archive only via `getLedgers`. |
| stellar-galexie | https://github.com/stellar/stellar-galexie | 3 | 2026-10-01 | Ledger metadata to S3 or GCS. You run it and pay for the storage. |
| stellar-etl | https://github.com/stellar/stellar-etl | 40 | 2026-10-07 | Feeds Hubble. Batch, not streaming. |
| stellar-dbt-public | https://github.com/stellar/stellar-dbt-public | 13 | 2026-10-07 | Hubble transformations. |
| stellar-horizon | https://github.com/stellar/stellar-horizon | 9 | 2026-10-06 | Heading to deprecation. |
| rs-stellar-rpc-client | https://github.com/stellar/rs-stellar-rpc-client | 4 | 2026-09-25 | Rust client. No multi-endpoint features evident. |
| js-stellar-sdk | https://github.com/stellar/js-stellar-sdk | 694 | 2026-10-07 | `rpc.Server` takes a single URL (inference from its API shape, not verified in this research). |
| Hubble (BigQuery `crypto-stellar.crypto_stellar`) | https://developers.stellar.org/docs/data/analytics/hubble | n/a | n/a | Full history, updated about every 15 minutes (30-min batch partitions). Not for real time. Users pay BigQuery query costs. Dataset is not discoverable in the Explorer pane. [Hubble docs](https://developers.stellar.org/docs/data/analytics/hubble) |
| Grafana dashboard 19229 "Stellar RPC" | https://grafana.com/grafana/dashboards/19229-soroban-rpc | n/a | n/a | Monitors only your own self-hosted node. [Monitoring guide](https://developers.stellar.org/docs/data/apis/rpc/admin-guide/monitoring) |

#### Commercial / hosted indexers (SDF indexer page)
- Alchemy: portfolio API (transfers, balances) plus RPC and address webhooks. Allium: planned Q1 2026 launch. Obsrvr: RPC plus Gateway, Obsrvr Flow in private beta. The Graph: Substreams only for Stellar, no subgraphs. Goldsky: Mirror/Pipelines for Stellar, subgraphs EVM only. Mercury: Retroshades for Soroban plus Mercury Classic (GraphQL contract events and transactions). SubQuery (300+ chains) and OnFinality hosting. Space and Time: Stellar since Q4 2025 — [SDF indexers page](http://developers.stellar.org/docs/data/indexers)
- SubQuery Stellar/Soroban package: `subquery/subql-stellar`, 4 stars, pushed 2026-10-02 — GitHub; [SubQuery quickstart](https://subquery.network/doc/indexer/quickstart/quickstart_chains/stellar-soroban.html)
- Zephyr: `xycloo/zephyr-vm` 3 stars, pushed 2026-09-03; `xycloo/zephyr-examples` 3 stars, last push 2024-11-05 (stale, about 23 months) — GitHub. Mercury's own docs were not fetched, so API details are unverified.
- `withObsrvr/flowctl`: 1 star, pushed 2026-06-14 — GitHub

#### RPC providers (SDF table)
Provider columns are Testnet/Mainnet/Dedicated/Archive per the [SDF providers page](https://developers.stellar.org/docs/data/apis/rpc/providers). Blockdaemon: T, M, dedicated, no archive. Validation Cloud: T, M, dedicated, archive (one page version disagrees; see [rpc-providers](https://developers.stellar.org/docs/data/rpc/rpc-providers)). QuickNode: T, M, dedicated, no archive. NowNodes: Futurenet, T, M, dedicated. Gateway: T, M, dedicated, archive. Ankr: T, M, no dedicated, archive. Infstones: M, dedicated. Obsrvr: T, M, archive. Nodies: T, M. OnFinality: M, dedicated, archive. Lightsail Quasar: M, archive. Uniblock: T, M. Exaion: M, dedicated, archive. Alchemy: T, M, dedicated. GetBlock: M, dedicated, archive. node101: T, M, dedicated, archive. Public endpoints: Liquify, sorobanrpc.com, SDF (Futurenet, Testnet only, no public SDF mainnet endpoint per older docs).
- The page gives no retention, latency, uptime or rate-limit data per provider. Archive means `getLedgers` only.

#### Community / obscure repos (GitHub, 2026-10-08)
All are young (2026), small, and unproven. None stale unless flagged.
- SoroTrail (https://github.com/sorotrail, Go, Apache-2.0): event indexer storing events beyond the RPC window with a JSON API. 2 stars, pushed 2026-10-05. SoroBeacon: rule-based event alerts to Discord, Slack, Telegram, email and webhooks. 1 star, 2026-10-04. SoroLens: decoded event explorer UI. 0 stars, 2026-09-14. This is the closest end-to-end stack to an event index plus alerts plus decoder, but it is tiny and weeks old.
- sorocore/soroban-indexer-sdk: TS monorepo with indexer, Postgres/Drizzle, RPC wrapper with retry, XDR parser, CLI. 4 stars, MIT, pushed 2026-07-08.
- equilibriumco/quasar "A Soroban Indexer": 4 stars, last push 2024-08-10 (STALE, about 26 months).
- kalepail/soroban-events-queue: 4 stars, 2023-08-07 (STALE).
- AstronLabs/soroban-indexer (production-grade historical indexer, pushed 2026-10-07), Akinyemi04/soroban-indexer (TS SDK, 2026-06-24), VeronicDev/Soroban-Indexer (adapter pattern plus REST, 2026-09-18), stellar-wave-dev/soroban-indexer-ts (polls RPC to SQL, 2026-07-12), ExcelDsigN-tech/soroban-sql-sync (Rust to Postgres, 2026-04-20): each 0 stars.
- App-specific indexers (EpochSend 10 stars, fundkeep-indexer 3, resolve-indexer 1, Harbor, Novatip, Heliobond, Lumina, ledja-indexer): bespoke backends. Their count shows teams repeatedly rebuild the same indexer.
- StellarViewOrg/stellarview-indexer (Go, ledgers/transactions/operations/contracts): 4 stars, pushed 2026-10-07. Creit-Tech/Stellar-Indexer-SDK: 1 star, 2026-09-10.
- Wallet and account webhooks: alpes214/stellar-hooks (0 stars, 2026-08-18), JohnOluB/Stellar-Webhook-Service (0, 2026-03-22), k2ghostyou/soroban-alert-system (0, 2026-05-18).
- Event decode/inspect: StellarFoundry/stellar-devkit (4 stars, Apache-2.0, pushed 2026-10-03). It decodes ScVal, envelope and ContractEvent XDR. The README says RPC support is only planned. Stellar-Cost-Labs/soroban-cost-estimator (5 stars, wraps simulateTransaction). AyinkxLab/ai-code-assistant (10 stars, read-only Stellar tooling).
- Captive core and ops: CodedMumu/Stellar-K8s (Rust Kubernetes operator for Stellar nodes, 1 star, 2026-09-06); ykoralla5/stellar-captive-core (0, 2025-02-05, borderline stale); bytemaster333/soroban-observability-hub (0, 2025-07-07, about 15 months, STALE); FelipeCalderaro/stellaris-prometheus-exporter (0, 2023-07-31, STALE); spixelk/stellar-monitoring-suite (0, 2026-05-28, host-level monitoring).
- StellarCanary/Protocol-Canary (Rust, Apache-2.0, 7 stars, pushed 2026-10-06): CLI that checks XDR, RPC response shapes and simulation compatibility across protocol versions.
- Other tracing/metrics: no Soroban-specific distributed-tracing or OpenTelemetry tool found in GitHub search ("soroban tracing" returned nothing).

### Inferences
- The ecosystem has many near-identical TS and Go event indexers with no clear winner and no shared schema, which supports a thin shared abstraction rather than another full indexer.
- Anything that stores events durably but lacks an `oldestLedger` and backfill-gap check is vulnerable to silent loss.

### Gaps
- Stars and push dates for Mercury's closed products and for Obsrvr Gateway were not available (no public repo found).
- stellar-expert, Colibri event-streamer (jsr.io `@colibri/event-streamer` exists per search results, repo not checked) and Soroswap indexer repos were not examined.
- The SCF award list was not systematically reviewed. Only Decentrio (full-featured transactions and events indexer plus RPC service), Sorobanhooks (proposed webhooks) and a monitoring-dashboard submission surfaced. Their delivery status is unconfirmed: [Decentrio](https://communityfund.stellar.org/project/decentrio-qrl); [monitoring dashboard submission](https://communityfund.stellar.org/submissions/recIEUbnDA95HE2Qn).

## Which tools exist for multi-RPC routing/health scoring, and how does StellarLens differ?

### Takeaway
No Stellar-specific, mature multi-RPC router with latency scoring was found. Closest are OpenZeppelin Monitor's endpoint rotation (rate-limit driven, weighted) and a weeks-old health-ping CLI. StellarLens ships latency-ranked fallback in an SDK, which appears to be a real gap-filler, though its scope is routing and diagnostics rather than data or monitoring.

### Cited Findings
- OpenZeppelin Monitor's RPC client supports multiple endpoints with weighted load balancing, automatic fallback, 429 handling that rotates to a fallback URL immediately, and connection health checks. Rotation is mainly rate-limit triggered, and no latency-based ranking appeared in the docs — [OZ Monitor RPC docs](https://docs.openzeppelin.com/monitor/1.0.x/rpc). Repo: 144 stars, pushed 2026-10-07 — GitHub. It is a monitor service, not a client SDK, and Stellar-specific limitations are not documented.
- `OlaBakare/stellar-rpc-ping`: TypeScript CLI that pings multiple RPC endpoints concurrently, measures latency, reads `getLatestLedger`, flags lagging nodes (synced/lagging/unreachable), and exports JSON or CSV. 1 star, created and pushed 2026-09-04, no license — [README](https://github.com/OlaBakare/stellar-rpc-ping). It is a one-shot observer, not a router or SDK.
- `sorocore/soroban-indexer-sdk` has an RPC wrapper with "robust retry handling" (single endpoint as described) — [README](https://github.com/sorocore/soroban-indexer-sdk)
- Health-score weighting by EMA latency plus error rate exists for Ethereum (graph-node PR #6128), not Stellar — [PR](https://gh.nn.ci/graphprotocol/graph-node/pull/6128)
- Per the local README, StellarLens provides: smart RPC routing (pool, latency-ranked, auto fallback), Soroban pre-flight simulation, XDR error decoding and a typed JSON-RPC client. It is read- and diagnostic-focused and does not sign or submit transactions. It is pre-1.0 — `/home/ezedikeevan/Desktop/blockchain/stellar/stellarlens/README.md`
- Public Stellar status is tracked only via third-party status aggregators (Pingoru, IncidentHub) of SDF components — [Pingoru](https://pingoru.io/providers/stellar/incidents/21071); [IncidentHub](https://incidenthub.cloud/status/stellar-org)

### Inferences
- Differentiators against the field: (a) SDK-embedded, in-process failover instead of a separate service (OZ Monitor) or CLI (stellar-rpc-ping); (b) latency ranking rather than only rate-limit rotation. Not yet differentiated: ledger-lag and `oldestLedger`-aware routing, per-method routing (for example send archive `getLedgers` and old `getEvents` only to providers whose window covers them), 429 or `Retry-After` backoff, and persisted health history. These are credible roadmap items given the findings above.
- Routing by retention coverage is a notable open niche: the SDF table lists "archive" per provider but no tool consumes it.

### Gaps
- I could not verify whether the js-stellar-sdk `rpc.Server` has any built-in failover (assumed none, unverified).
- No uptime or latency benchmark data across providers (Blockdaemon, QuickNode, Ankr and others) was found, so no public comparison to benchmark against exists in my sources.
- No search of private or closed solutions (provider-side load balancers) was possible.

## Which gaps would a dev-tool suite (SDK + CLI + dashboard + monitoring agent) best fill?

### Takeaway
Best-supported gaps: multi-provider RPC routing and health scoring aware of retention windows; a probe-based public RPC status dashboard; a durable, gap-aware event store with polling-to-stream adapter and alerting; and a Soroban-aware observability layer. Note several 2026 community projects are racing in the indexer and alerting areas.

### Cited Findings
- No public multi-provider RPC status or latency dashboard was found; only self-hosted Grafana and third-party SDF status pages exist — see the monitoring and status findings above.
- No tracing or OpenTelemetry tooling for Soroban found; one stale repo (soroban-observability-hub, 2025-07-07) — GitHub
- Rate limits and retention per provider are undocumented in aggregate, per the SDF provider table.
- The SDF itself recommends users ingest events themselves — [Ingest events guide](https://developers.stellar.org/docs/smart-contracts/guides/events/ingest)

### Inferences (ranked, with competition risk)
1. RPC health and retention probe (CLI plus agent plus public dashboard): measure per provider latency, p99, error and 429 rates, ledger lag, `getHealth.oldestLedger` and archive `getLedgers` success. Competition: only stellar-rpc-ping (1 star). Low risk, high value, and it feeds the SDK's routing score.
2. SDK routing upgrades: retention-aware method routing, 429/Retry-After handling, hedged requests, circuit breakers, ledger-lag exclusion. Competition: none for Stellar.
3. Gap-aware event follower: cursor management, dedup by event id, detection of "start ledger below oldest" and automatic backfill via a data lake or archive provider, exposed as a stream (async iterator, SSE or WebSocket) on top of polling. Competition: SoroTrail and other new indexers, but they are full indexers; a thin, pluggable follower is lighter.
4. Alerting for RPC and contracts: agent that alerts on provider degradation, ledger stall and retention-window loss. Competition for contract-event alerts: OZ Monitor, SoroBeacon, Alchemy. Provider-health alerting has no competitor found.
5. Decoding: shared decode-to-readable events and errors (StellarLens already decodes errors; stellar-devkit and SoroLens decode events). Moderate overlap.
- Avoid building a general indexer: Mercury, SubQuery, Goldsky, Obsrvr, Alchemy and about 10 community repos already occupy it.

### Gaps
- Demand evidence (forum threads, issues, SCF round data) was not gathered; recommendations are inferred from tooling absence, not from user research.
- Pricing and feasibility of a hosted probe network were not assessed.
