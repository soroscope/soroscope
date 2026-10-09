---
title: RawSimulateResponse
description: Interface RawSimulateResponse — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/simulation/types.ts:31

The raw `simulateTransaction` response. Captured from live Stellar RPC: the
response carries no CPU/memory `cost` object; resource use is in
`transactionData`.

## Properties

### error?

> `optional` **error?**: `string`

Defined in: packages/core/src/simulation/types.ts:34

Present only when the simulation failed.

***

### events?

> `optional` **events?**: `string`[]

Defined in: packages/core/src/simulation/types.ts:40

Base64 `DiagnosticEvent` entries emitted during simulation.

***

### latestLedger

> **latestLedger**: `number`

Defined in: packages/core/src/simulation/types.ts:32

***

### minResourceFee?

> `optional` **minResourceFee?**: `string`

Defined in: packages/core/src/simulation/types.ts:38

Minimum resource fee in stroops, as a decimal string.

***

### restorePreamble?

> `optional` **restorePreamble?**: `object`

Defined in: packages/core/src/simulation/types.ts:44

Present when archived ledger entries must be restored before submitting.

#### minResourceFee

> **minResourceFee**: `string`

#### transactionData

> **transactionData**: `string`

***

### results?

> `optional` **results?**: `object`[]

Defined in: packages/core/src/simulation/types.ts:42

Invocation results: at most one for a Soroban operation.

#### auth?

> `optional` **auth?**: `string`[]

#### xdr

> **xdr**: `string`

***

### stateChanges?

> `optional` **stateChanges?**: [`RawStateChange`](/docs/reference/rawstatechange)[]

Defined in: packages/core/src/simulation/types.ts:45

***

### transactionData?

> `optional` **transactionData?**: `string`

Defined in: packages/core/src/simulation/types.ts:36

Base64 `SorobanTransactionData` (footprint and resources).
