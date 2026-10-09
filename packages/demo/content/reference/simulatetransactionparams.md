---
title: SimulateTransactionParams
description: Interface SimulateTransactionParams — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/simulation/types.ts:9

Parameters accepted by the `simulateTransaction` JSON-RPC method.

## Properties

### resourceConfig?

> `optional` **resourceConfig?**: `object`

Defined in: packages/core/src/simulation/types.ts:12

#### instructionLeeway

> **instructionLeeway**: `number`

***

### transaction

> **transaction**: `string`

Defined in: packages/core/src/simulation/types.ts:11

Base64-encoded `TransactionEnvelope` XDR to simulate.
