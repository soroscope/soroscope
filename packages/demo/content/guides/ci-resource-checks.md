---
title: CI resource checks
description: Fail a pull request when a Soroban call gets more expensive, using a committed baseline and the GitHub Action.
---

Soroban meters CPU instructions, ledger reads and writes, and a resource fee, and each is a limit your contract can hit. A refactor can quietly double one of them. The check measures a list of calls with `simulateTransaction`, compares them with a **baseline you commit**, and fails the build when one regresses.

## Two modes

- **Mode A: a deployed contract.** Each invocation names a `contractId`. Good for staging or mainnet monitoring. Needs no keys at all.
- **Mode B: your build.** `contracts` points at compiled WASM. The check deploys it to **testnet** with a throwaway key funded by friendbot, runs your setup calls, then measures. This is what catches a regression in code that is not deployed yet. It refuses to run on mainnet.

## The config

`soroscope.config.json`:

```json
{
  "version": 1,
  "network": { "name": "testnet" },
  "contracts": {
    "token": {
      "wasm": "target/wasm32v1-none/release/token.wasm",
      "setup": [{ "function": "initialize", "args": { "admin": "$deployer" } }]
    }
  },
  "invocations": [
    { "name": "transfer", "contract": "token", "function": "transfer",
      "args": { "from": "$deployer", "to": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR", "amount": 100 },
      "source": "$deployer" },
    { "name": "overdraft fails", "contract": "token", "function": "transfer",
      "args": { "from": "$deployer", "to": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR", "amount": 99999999999 },
      "expect": { "success": false, "errorName": "InsufficientFunds" } }
  ],
  "thresholds": { "instructions": { "maxIncreasePct": 5 } },
  "budgets": { "instructions": 100000000 }
}
```

`$deployer` is the throwaway account; `$token` would be the deployed contract's id. Arguments are named (typed from the contract spec) or, for a Stellar Asset Contract, a list of `{ "type", "value" }`. The full list of fields is in the [config reference](/docs/api/ci-config), and a JSON Schema is available for editor validation.

## The baseline

```sh
soroscope check --update-baseline    # record the current numbers
git add soroscope.baseline.json      # commit it with the change that explains it
soroscope check                      # compare
```

The baseline stores each call's instructions, disk reads, writes, fee and its **ledger footprint** (which entries it reads and writes). It is deterministic JSON, so a diff shows only real changes. Contract ids and the deployer are replaced by stable aliases (`$token`, `$deployer`), which is what makes two separate deployments of the same code compare equal.

## What fails

| Change | Result |
|---|---|
| Instructions, disk reads or writes grow more than the threshold (default 5%) | **fail** |
| Resource fee grows more than 10% | warn (it also moves with network fee settings) |
| The call now **writes** a ledger entry it did not before | **fail** |
| An entry it only read is now written | **fail** |
| The call now reads a new entry | warn |
| Over an absolute `budgets` ceiling | **fail** |
| The call fails when it should succeed (or the reverse, or with the wrong error name) | **fail** |
| No baseline entry for a call yet | warn (or fail with `failOnMissingBaseline`) |
| A big improvement | info |

If the protocol version changed since the baseline was recorded, fee comparisons only warn.

## The GitHub Action

```yaml
name: Resource check
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      # build your contract's WASM here
      - uses: soroscope/soroscope/packages/ci@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

It writes the report to the job summary, annotates each regression, sets the outputs `result`, `regressions` and `report-path`, and posts one pull-request comment that it **updates in place** on every push. On a pull request from a fork the token is read-only; the report is still in the job summary.

| Input | Default | |
|---|---|---|
| `config` | `soroscope.config.json` | Path to the config. |
| `working-directory` | `.` | Config and WASM paths resolve against it. |
| `update-baseline` | `false` | Record instead of compare. |
| `fail-on` | `regression` | `regression`, `warning` or `never`. |
| `github-token` | | Enables the PR comment. |
| `comment` | `true` | |
| `deployer-secret` | | A funded testnet key to use instead of a throwaway one. |

## Measuring honestly

Simulation costs depend on ledger state, so measure against state you control (Mode B does this) or a stable deployed contract. The RPC reports no memory figure, so memory is not gated.
