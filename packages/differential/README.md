# @soroscope/differential

Simulate one call on several RPC providers and report where they disagree.

| Status | |
|---|---|
| Maturity | **preview**: tested on responses recorded from five real mainnet providers |
| Published | no (private; `@soroscope/cli` uses it for `simulate --compare`) |

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

Exit code 0 when they agree, 1 when they disagree, 3 when none answered.

```ts
import { differentialSimulate } from '@soroscope/differential';
const report = await differentialSimulate(transactionXdr, { providers });
report.disagreements; // [{ field: 'returnValue', groups: [{ value: '7', providers: [...] }, ...], ledgerSkew: false }]
```

Each provider is asked directly, not through the router. For every field (outcome, error, return value, authorizations, fee, instructions, read and write bytes, footprint) providers are grouped by the value they gave; more than one group is a disagreement, and the larger group is listed first. A provider that did not answer is listed and left out of the comparison: a timeout is not a disagreement. `ledgerSkew` is set when providers answered at different ledgers, which can explain a state-dependent difference without anyone being wrong.

## What has been measured

[`provider-answers.json`](./tests/fixtures/provider-answers.json) holds what the five public mainnet providers answered to three calls at the same moment, including a DEX quote that moves with every trade. **They agreed on all three.** That is a finding: on this sample there was nothing to report.

The grouping logic is tested with real responses to different calls paired under provider names. The tests say so; they exercise the report, they are not providers disagreeing. A real disagreement, when one turns up, belongs in the fixtures.
