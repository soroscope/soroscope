---
title: Simulating contract calls
description: Build a call from a contract's own spec, simulate it, and read a fully decoded report.
---

`simulateTransaction` is the only way to learn what a Soroban call will cost and need before you pay for it. Soroscope turns its raw base64 answer into a decoded `SimulationReport`.

## Build the call

`@soroscope/invoke` builds an **unsigned** transaction from a contract's own spec, so you pass named arguments and get the right Soroban types:

```ts
import { SoroscopeRouter, publicProviderUrls } from '@soroscope/core'
import { buildInvocationXdr, loadSpec } from '@soroscope/invoke'

const router = await SoroscopeRouter.create({ providers: publicProviderUrls('testnet') })
// Soroscope's own fixture contract on testnet (testnet is reset now and then; substitute yours).
const { spec } = await loadSpec(router, 'CCKC6K5BONT23RHCCUZK2YX4Q5ONB6E3KCT6S7A6DAVHZXXM2TRYDMAN')

const xdr = buildInvocationXdr({
  contractId: 'CCKC6K5BONT23RHCCUZK2YX4Q5ONB6E3KCT6S7A6DAVHZXXM2TRYDMAN',
  function: 'work',
  args: { n: 100 },
  source: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR',
  networkPassphrase: 'Test SDF Network ; September 2015',
  spec,
})
```

The source account does not need to exist.

A Stellar Asset Contract has no spec; pass typed positional arguments instead: `args: [{ type: 'address', value: 'G...' }]`.

## Simulate

```ts
import { TransactionSimulator, describeSimulation } from '@soroscope/core'

const sim = new TransactionSimulator(router)
const report = await sim.simulateAndExplain(xdr)
console.log(describeSimulation(report))
```

`simulate()` returns the report. `simulateAndExplain()` additionally looks up the failing contract's spec so its error code gets its declared name.

## The report

| Field | Meaning |
|---|---|
| `ok` | The simulation succeeded. |
| `returnValue` | Decoded `ScVal` (`null` if none). Use `scValToJs()` for plain JavaScript. |
| `transactionData` | Footprint (`readOnly`, `readWrite` ledger keys) and resources: `instructions`, `diskReadBytes`, `writeBytes`, `resourceFee`. |
| `minResourceFee` | Minimum resource fee in stroops. |
| `auth` | One entry per address that must authorize, with the call tree it covers. |
| `events` | Decoded diagnostic events. |
| `stateChanges` | Ledger entries the call creates, updates or deletes. |
| `restorePreamble` | Present when archived entries must be restored first. |
| `failure` | For a failed call, the contract that raised the error, its code, the contract's own message, and the error name from the spec. |

## What to expect

- Integers wider than 32 bits are `bigint`.
- There is no memory figure. Current RPC responses do not report one.
- Authorization entries from simulation have no signatures yet; the report tells you *who* must sign.
