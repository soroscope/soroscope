---
title: scValToJs
description: Function scValToJs — @soroscope/core API reference.
generated: true
---

> **scValToJs**(`v`): `unknown`

Defined in: packages/core/src/decode/scval.ts:235

Convert an `ScVal` into plain, JSON-safe JavaScript. Integers wider than 32
bits become decimal strings (JSON cannot carry them losslessly), bytes become
hex, addresses become strkeys, maps become arrays of `[key, value]` pairs
unless every key is a string or symbol (then an object).

## Parameters

### v

[`ScVal`](/docs/reference/scval)

## Returns

`unknown`
