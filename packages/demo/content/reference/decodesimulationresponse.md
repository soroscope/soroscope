---
title: decodeSimulationResponse
description: Function decodeSimulationResponse — @soroscope/core API reference.
generated: true
---

> **decodeSimulationResponse**(`raw`): [`SimulationReport`](/docs/reference/simulationreport)

Defined in: packages/core/src/simulation/report.ts:22

Decode a raw `simulateTransaction` response. Pure: no network access.

## Parameters

### raw

[`RawSimulateResponse`](/docs/reference/rawsimulateresponse)

## Returns

[`SimulationReport`](/docs/reference/simulationreport)

## Throws

If any embedded XDR is malformed.
