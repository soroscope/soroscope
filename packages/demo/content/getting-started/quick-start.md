---
title: Quick Start
description: Probe your providers, route a call, and read a failed simulation in five minutes.
---

## 1. See what your providers really do

```sh
soroscope probe --network mainnet
```

```
PROVIDER                               STATUS    P50    P95    LAG  WINDOW  LEDGERS REACH  PROTO
rpc.lightsail.network                  healthy   379ms  6975ms 1    7.0d    7.1d           29
soroban-rpc.creit.tech                 healthy   355ms  6318ms 1    1.0d    -              29
archive-rpc.lightsail.network          degraded  2506ms 3514ms 0    0.0d    730d*          29
```

`WINDOW` is the history a provider advertises. `LEDGERS REACH` is how far back `getLedgers` really answered when the probe tried. A `*` means it reaches beyond the advertised window.

## 2. Route calls to a provider that can serve them

```ts
import { SoroscopeRouter, publicProviderUrls } from '@soroscope/core'

const router = await SoroscopeRouter.create({
  providers: publicProviderUrls('mainnet'),
})

// Needs history from ledger 64_800_000: only providers that retain it are tried.
const events = await router.call('getEvents', {
  startLedger: 64_800_000,
  filters: [{ type: 'contract' }],
  pagination: { limit: 10 },
})
```

If no provider retains that ledger the router throws `NoEligibleProviderError` and tells you why each one was ruled out, instead of sending the request somewhere it will be refused.

## 3. Simulate a call and read the result

```ts
import { TransactionSimulator, describeSimulation } from '@soroscope/core'
import { buildInvocationXdr, loadSpec } from '@soroscope/invoke'

const { spec } = await loadSpec(router, contractId)
const xdr = buildInvocationXdr({
  contractId,
  function: 'transfer',
  args: { from, to, amount: 100n },
  source: from,
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
  spec,
})

const report = await new TransactionSimulator(router).simulateAndExplain(xdr)
console.log(describeSimulation(report))
// Simulation failed: Contract CC... raised Error(Contract, #2) (Error::InsufficientFunds).
```

Nothing is signed or sent. The source account does not even need to exist.

## 4. Do the same from the shell

```sh
soroscope simulate --contract CC... --fn transfer --args '{"from":"G...","to":"G...","amount":"100"}'
```

Next: [what providers really do](/docs/guides/rpc-provider-notes), [CI resource checks](/docs/guides/ci-resource-checks).
