---
title: Compare providers
description: Simulate one call on every RPC provider and see exactly where they disagree.
---

Two RPC providers can answer the same `simulateTransaction` differently: one lags the network, one runs a different protocol during an upgrade, one is misconfigured. `soroscope simulate --compare` asks each provider directly and shows you.

> **Status: preview.** Tested on responses recorded from five real mainnet providers. `@soroscope/differential` is not on npm yet; `--compare` is part of the CLI.

## From the command line

```sh
soroscope simulate --network mainnet --contract CAG5LR… --fn router_get_amounts_out --args '{…}' --compare
```

```
5 of 5 providers answered.
  ✓ mainnet.sorobanrpc.com  ledger 65337825  358ms  succeeded
  ✓ soroban-rpc.mainnet.stellar.gateway.fm  ledger 65337825  410ms  succeeded
  …
No disagreement: every provider that answered gave the same result, resources and footprint.
```

| Exit code | Meaning |
|---|---|
| 0 | Every provider that answered agrees. |
| 1 | At least one field has more than one answer. |
| 3 | No provider answered. |

## From code

```ts
import { differentialSimulate } from '@soroscope/differential'

const report = await differentialSimulate(transactionXdr, { providers })
report.disagreements
// [{ field: 'returnValue', groups: [{ value: '7', providers: [...] }, ...], ledgerSkew: false }]
```

## How it decides

Each provider is asked **directly**, not through the router, so the router's choices cannot hide a difference.

For every field (outcome, error, return value, authorizations, fee, instructions, read and write bytes, footprint) providers are grouped by the value they gave. More than one group is a disagreement, and the larger group is listed first.

- **A provider that did not answer is listed and left out.** A timeout is not a disagreement.
- **`ledgerSkew`** is set when providers answered at different ledgers. That can explain a state-dependent difference without anyone being wrong. Check it before deciding a provider is faulty.

## What has been measured

Five public mainnet providers answered three calls at the same moment, including a DEX quote that moves with every trade. **They agreed on all three.** That is a finding, not a gap: on this sample there was nothing to report.

The grouping logic is tested with real responses to different calls paired under provider names. Those tests exercise the report; they are not providers disagreeing. A real disagreement, when one turns up, will be added to the fixtures.

If you see providers disagree, [open an issue](https://github.com/soroscope/soroscope/issues) with the `--json` output. It is the evidence this feature is missing.
