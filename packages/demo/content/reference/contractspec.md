---
title: ContractSpec
description: Class ContractSpec — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/spec/ContractSpec.ts:30

What a contract says about itself: its functions, types, events and error
codes. Built from the spec embedded in the contract's WASM.

## Constructors

### Constructor

> **new ContractSpec**(`entries`, `source?`, `meta?`): `ContractSpec`

Defined in: packages/core/src/spec/ContractSpec.ts:38

#### Parameters

##### entries

readonly [`SpecEntry`](/docs/reference/specentry)[]

##### source?

[`ContractSource`](/docs/reference/contractsource) = `...`

##### meta?

[`ContractMeta`](/docs/reference/contractmeta) = `{}`

#### Returns

`ContractSpec`

## Properties

### entries

> `readonly` **entries**: readonly [`SpecEntry`](/docs/reference/specentry)[]

Defined in: packages/core/src/spec/ContractSpec.ts:39

***

### enums

> `readonly` **enums**: readonly [`SpecEnum`](/docs/reference/specenum)[]

Defined in: packages/core/src/spec/ContractSpec.ts:34

***

### errors

> `readonly` **errors**: readonly [`ContractErrorInfo`](/docs/reference/contracterrorinfo)[]

Defined in: packages/core/src/spec/ContractSpec.ts:36

***

### events

> `readonly` **events**: readonly [`SpecEvent`](/docs/reference/specevent)[]

Defined in: packages/core/src/spec/ContractSpec.ts:35

***

### functions

> `readonly` **functions**: readonly [`SpecFunction`](/docs/reference/specfunction)[]

Defined in: packages/core/src/spec/ContractSpec.ts:31

***

### meta

> `readonly` **meta**: [`ContractMeta`](/docs/reference/contractmeta) = `{}`

Defined in: packages/core/src/spec/ContractSpec.ts:41

***

### source

> `readonly` **source**: [`ContractSource`](/docs/reference/contractsource)

Defined in: packages/core/src/spec/ContractSpec.ts:40

***

### structs

> `readonly` **structs**: readonly [`SpecStruct`](/docs/reference/specstruct)[]

Defined in: packages/core/src/spec/ContractSpec.ts:32

***

### unions

> `readonly` **unions**: readonly [`SpecUnion`](/docs/reference/specunion)[]

Defined in: packages/core/src/spec/ContractSpec.ts:33

## Methods

### function()

> **function**(`name`): [`SpecFunction`](/docs/reference/specfunction) \| `undefined`

Defined in: packages/core/src/spec/ContractSpec.ts:56

The function with this name, if the contract declares it.

#### Parameters

##### name

`string`

#### Returns

[`SpecFunction`](/docs/reference/specfunction) \| `undefined`

***

### lookupError()

> **lookupError**(`code`): [`ContractErrorInfo`](/docs/reference/contracterrorinfo) \| `undefined`

Defined in: packages/core/src/spec/ContractSpec.ts:69

The error with this code, or undefined when none (or only an ambiguous set) matches.

#### Parameters

##### code

`number`

#### Returns

[`ContractErrorInfo`](/docs/reference/contracterrorinfo) \| `undefined`

***

### lookupErrors()

> **lookupErrors**(`code`): [`ContractErrorInfo`](/docs/reference/contracterrorinfo)[]

Defined in: packages/core/src/spec/ContractSpec.ts:64

Every error the contract declares with this code. Normally one; a contract
may reuse a number across enums, so callers should treat more than one as ambiguous.

#### Parameters

##### code

`number`

#### Returns

[`ContractErrorInfo`](/docs/reference/contracterrorinfo)[]

***

### empty()

> `static` **empty**(`source`): `ContractSpec`

Defined in: packages/core/src/spec/ContractSpec.ts:75

A spec for a contract with no WASM spec (the built-in Stellar Asset Contract).

#### Parameters

##### source

[`ContractSource`](/docs/reference/contractsource)

#### Returns

`ContractSpec`
