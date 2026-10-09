---
title: CI config reference
description: Every field of soroscope.config.json.
---

Validated with a strict schema: unknown fields are errors, and every problem is listed at once. `configJsonSchema()` from `@soroscope/ci` returns the JSON Schema for editors.

## Top level

| Field | Default | |
|---|---|---|
| `version` | required | Must be `1`. |
| `network.name` | `testnet` | `testnet` or `mainnet`. |
| `network.rpc` | verified public providers | Your own endpoints. |
| `baseline` | `soroscope.baseline.json` | Relative to the config file. |
| `defaults.source` | placeholder address | Source for invocations that give none. |
| `failOnMissingBaseline` | `false` | Fail, not warn, when a call has no baseline yet. |
| `contracts` | `{}` | Mode B: WASM to deploy. |
| `invocations` | required | The calls to measure. |
| `budgets` | `{}` | Absolute ceilings. |
| `thresholds` | `{}` | Allowed growth over the baseline. |

## `contracts.<alias>`

| | |
|---|---|
| `wasm` | Path to the compiled module, relative to the config. |
| `setup` | Calls made after deployment, each `{ function, args }`, signed by the deployer. |

## `invocations[]`

| | |
|---|---|
| `name` | Unique. Keys the baseline. |
| `contract` **or** `contractId` | An alias under `contracts`, or an already-deployed `C...` id. Exactly one. |
| `function` | Function to call. |
| `args` | Named object, or a list of `{ "type", "value" }`. |
| `source` | `G...` or `$deployer`. |
| `expect.success` | `false` for a call that should fail. |
| `expect.errorName` | For an expected failure, the contract error name. |

String values equal to `$deployer` or `$<alias>` are replaced with the throwaway deployer's address or the deployed contract's id.

## `thresholds`

For `instructions`, `diskReadBytes`, `writeBytes` and `resourceFee`: `maxIncreasePct` (defaults 5, and 10 for the fee), `maxIncreaseAbs` (default 0, added to the percentage allowance) and `level` (`fail`, `warn` or `ignore`; the fee defaults to `warn`, the rest to `fail`).

`footprint.allowNewKeys` and `footprint.allowReadOnlyToReadWrite` (both default `false`) control whether a call may start writing entries.

## `budgets`

`instructions`, `diskReadBytes`, `writeBytes`, `resourceFee` and `readWriteKeys`. A call over a budget fails whatever the baseline says.
