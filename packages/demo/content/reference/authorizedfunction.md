---
title: AuthorizedFunction
description: TypeAlias AuthorizedFunction — @soroscope/core API reference.
generated: true
---

> **AuthorizedFunction** = \{ `args`: [`ScVal`](/docs/reference/scval)[]; `contract`: [`ScAddress`](/docs/reference/scaddress); `functionName`: `string`; `type`: `"contractFn"`; \} \| \{ `constructorArgs`: [`ScVal`](/docs/reference/scval)[] \| `null`; `executable`: [`ContractExecutable`](/docs/reference/contractexecutable); `preimage`: [`ContractIdPreimage`](/docs/reference/contractidpreimage); `type`: `"createContract"`; \}

Defined in: packages/core/src/decode/auth.ts:14

## Union Members

### Type Literal

\{ `args`: [`ScVal`](/docs/reference/scval)[]; `contract`: [`ScAddress`](/docs/reference/scaddress); `functionName`: `string`; `type`: `"contractFn"`; \}

***

### Type Literal

\{ `constructorArgs`: [`ScVal`](/docs/reference/scval)[] \| `null`; `executable`: [`ContractExecutable`](/docs/reference/contractexecutable); `preimage`: [`ContractIdPreimage`](/docs/reference/contractidpreimage); `type`: `"createContract"`; \}

#### constructorArgs

> **constructorArgs**: [`ScVal`](/docs/reference/scval)[] \| `null`

Present for the v2 form only.

#### executable

> **executable**: [`ContractExecutable`](/docs/reference/contractexecutable)

#### preimage

> **preimage**: [`ContractIdPreimage`](/docs/reference/contractidpreimage)

#### type

> **type**: `"createContract"`
