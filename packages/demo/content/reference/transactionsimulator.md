---
title: TransactionSimulator
description: Class TransactionSimulator — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/simulation/TransactionSimulator.ts:22

Runs `simulateTransaction` through any [RpcCaller](/docs/reference/rpccaller) (one endpoint or a
router) and returns a fully decoded [SimulationReport](/docs/reference/simulationreport).

## Example

```ts
const sim = new TransactionSimulator(router);
const report = await sim.simulate(txXdr);
console.log(describeSimulation(report));
```

## Constructors

### Constructor

> **new TransactionSimulator**(`caller`): `TransactionSimulator`

Defined in: packages/core/src/simulation/TransactionSimulator.ts:23

#### Parameters

##### caller

[`RpcCaller`](/docs/reference/rpccaller)

#### Returns

`TransactionSimulator`

## Methods

### estimateFee()

> **estimateFee**(`transactionXdr`, `options?`): `Promise`\<`bigint`\>

Defined in: packages/core/src/simulation/TransactionSimulator.ts:65

The minimum resource fee in stroops.

#### Parameters

##### transactionXdr

`string`

##### options?

[`SimulateOptions`](/docs/reference/simulateoptions) = `{}`

#### Returns

`Promise`\<`bigint`\>

#### Throws

If the simulation fails.

***

### simulate()

> **simulate**(`transactionXdr`, `options?`): `Promise`\<[`SimulationReport`](/docs/reference/simulationreport)\>

Defined in: packages/core/src/simulation/TransactionSimulator.ts:30

Simulate a transaction.

#### Parameters

##### transactionXdr

`string`

Base64 `TransactionEnvelope`.

##### options?

[`SimulateOptions`](/docs/reference/simulateoptions) = `{}`

#### Returns

`Promise`\<[`SimulationReport`](/docs/reference/simulationreport)\>

#### Throws

If `transactionXdr` is empty.

***

### simulateAndExplain()

> **simulateAndExplain**(`transactionXdr`, `options?`): `Promise`\<[`SimulationReport`](/docs/reference/simulationreport)\>

Defined in: packages/core/src/simulation/TransactionSimulator.ts:46

Simulate, and when the call fails with a contract error, look up the
contract's spec so the error carries its declared name.

#### Parameters

##### transactionXdr

`string`

##### options?

[`SimulateOptions`](/docs/reference/simulateoptions) = `{}`

#### Returns

`Promise`\<[`SimulationReport`](/docs/reference/simulationreport)\>
