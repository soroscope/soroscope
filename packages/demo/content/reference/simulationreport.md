---
title: SimulationReport
description: Interface SimulationReport — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/simulation/types.ts:58

A simulation, fully decoded. Nothing is left as base64 except raw ledger entry bodies.

## Properties

### auth

> **auth**: [`AuthEntry`](/docs/reference/authentry)[]

Defined in: packages/core/src/simulation/types.ts:65

Authorizations the transaction will need, one per address that must sign.

***

### error

> **error**: `string` \| `null`

Defined in: packages/core/src/simulation/types.ts:75

The raw error text when the simulation failed.

***

### events

> **events**: [`DiagnosticEvent`](/docs/reference/diagnosticevent)[]

Defined in: packages/core/src/simulation/types.ts:66

***

### failure

> **failure**: [`ContractFailure`](/docs/reference/contractfailure) \| `null`

Defined in: packages/core/src/simulation/types.ts:77

The contract error behind a failure, when the diagnostic events identify one.

***

### latestLedger

> **latestLedger**: `number`

Defined in: packages/core/src/simulation/types.ts:61

***

### minResourceFee

> **minResourceFee**: `bigint` \| `null`

Defined in: packages/core/src/simulation/types.ts:70

Minimum resource fee in stroops.

***

### ok

> **ok**: `boolean`

Defined in: packages/core/src/simulation/types.ts:60

True when the simulation succeeded.

***

### restorePreamble

> **restorePreamble**: \{ `minResourceFee`: `bigint`; `transactionData`: [`SorobanTransactionData`](/docs/reference/sorobantransactiondata); \} \| `null`

Defined in: packages/core/src/simulation/types.ts:72

Archived entries that must be restored before the transaction can succeed.

***

### returnValue

> **returnValue**: [`ScVal`](/docs/reference/scval) \| `null`

Defined in: packages/core/src/simulation/types.ts:63

The call's return value; null if it failed or returned nothing.

***

### stateChanges

> **stateChanges**: [`StateChange`](/docs/reference/statechange)[]

Defined in: packages/core/src/simulation/types.ts:73

***

### transactionData

> **transactionData**: [`SorobanTransactionData`](/docs/reference/sorobantransactiondata) \| `null`

Defined in: packages/core/src/simulation/types.ts:68

Footprint and resource budget the transaction should declare.
