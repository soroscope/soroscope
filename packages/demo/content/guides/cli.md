---
title: Command line
description: The soroscope command - probe providers, decode XDR, read contract specs, simulate calls, and check resource budgets.
---

```sh
npm install --global @soroscope/cli
```

Data goes to stdout and diagnostics to stderr, so output is safe to pipe.

## Global options

| Option | |
|---|---|
| `--network testnet\|mainnet` | Use the verified public providers for a network (default `testnet`, or `SOROSCOPE_NETWORK`). |
| `--rpc <url>` | Use this endpoint instead; repeat for several. Also `SOROSCOPE_RPC_URLS` (comma separated). |

## Commands

| Command | |
|---|---|
| `probe` | Latency, ledger lag, retention and real `getLedgers` reach for each provider. `--format table\|json\|prometheus`, `--samples`, `--burst`, `--no-reach`, `--strict`, `--watch`, `--serve <port>`. |
| `route-explain <method> [params]` | Which provider would serve it, and why not the others. |
| `decode <type> <base64>` | Decode XDR. `-` reads standard input. |
| `explain <base64>` | One-line explanation of a transaction result. |
| `spec <contractId\|file.wasm>` | Functions, errors, events and types. |
| `simulate --contract C... --fn name --args '{...}'` | Simulate a call and explain the result. |
| `check` | Run [CI resource checks](/docs/guides/ci-resource-checks) locally. `--update-baseline`, `--format text\|markdown\|json`, `--fail-on regression\|warning`. |

## Monitoring with Prometheus

```sh
soroscope probe --network mainnet --serve 9464 --interval 30
```

serves `/metrics` (Prometheus text) and `/probe` (JSON), re-probing every 30 seconds. Metrics include `soroscope_provider_up`, `soroscope_provider_latency_p95_ms`, `soroscope_provider_ledger_lag`, `soroscope_provider_retention_days` and `soroscope_provider_getledgers_reach_days`, labelled by `provider` and `network`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success. |
| 1 | The command ran and its verdict is a failure (`--strict` probe with an unhealthy provider, a regression, a failed simulation). |
| 2 | Bad usage or configuration. |
| 3 | No provider could be reached, or none can serve the request. |
| 4 | Internal error. |

The CLI never accepts a secret key.
