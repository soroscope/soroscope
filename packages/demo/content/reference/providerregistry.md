---
title: ProviderRegistry
description: Class ProviderRegistry — @soroscope/core API reference.
generated: true
---

Defined in: packages/core/src/routing/ProviderRegistry.ts:151

Tracks everything the router knows about each provider and answers two
questions: "which providers can serve this request?" and "in what order
should they be tried?". It is a plain state machine: it performs no I/O and
takes its clock as a parameter, so its behaviour is a function of the
observations fed into it.

## Constructors

### Constructor

> **new ProviderRegistry**(`config?`): `ProviderRegistry`

Defined in: packages/core/src/routing/ProviderRegistry.ts:156

#### Parameters

##### config?

[`RegistryConfig`](/docs/reference/registryconfig) = `{}`

#### Returns

`ProviderRegistry`

## Methods

### eligible()

> **eligible**(`req`, `exclude?`, `at?`): `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:366

Split providers into those that can serve the request and those that cannot, with reasons.

#### Parameters

##### req

[`RoutingRequirements`](/docs/reference/routingrequirements)

##### exclude?

`ReadonlySet`\<`string`\> = `...`

##### at?

`number` = `...`

#### Returns

`object`

##### eligible

> **eligible**: [`ProviderRecord`](/docs/reference/providerrecord)[]

##### excluded

> **excluded**: [`Exclusion`](/docs/reference/exclusion)[]

***

### estimatedLedgers()

> **estimatedLedgers**(`id`, `at?`): `object`

Defined in: packages/core/src/routing/ProviderRegistry.ts:325

Extrapolated ledger bounds for a provider, assuming ~5s ledger closes since it was observed.

#### Parameters

##### id

`string`

##### at?

`number` = `...`

#### Returns

`object`

##### latest

> **latest**: `number` \| `null`

##### oldest

> **oldest**: `number` \| `null`

***

### get()

> **get**(`id`): [`ProviderRecord`](/docs/reference/providerrecord) \| `undefined`

Defined in: packages/core/src/routing/ProviderRegistry.ts:200

#### Parameters

##### id

`string`

#### Returns

[`ProviderRecord`](/docs/reference/providerrecord) \| `undefined`

***

### lagOf()

> **lagOf**(`id`, `at?`): `number` \| `null`

Defined in: packages/core/src/routing/ProviderRegistry.ts:337

How many ledgers a provider trails the best provider on its network.

#### Parameters

##### id

`string`

##### at?

`number` = `...`

#### Returns

`number` \| `null`

***

### list()

> **list**(): [`ProviderRecord`](/docs/reference/providerrecord)[]

Defined in: packages/core/src/routing/ProviderRegistry.ts:204

#### Returns

[`ProviderRecord`](/docs/reference/providerrecord)[]

***

### now()

> **now**(): `number`

Defined in: packages/core/src/routing/ProviderRegistry.ts:161

#### Returns

`number`

***

### oldestServable()

> **oldestServable**(`id`, `method`, `at?`): `number` \| `null`

Defined in: packages/core/src/routing/ProviderRegistry.ts:355

The oldest ledger a provider can serve for a method, or null if unknown.
`getLedgers` can reach beyond the advertised window; everything else cannot.

#### Parameters

##### id

`string`

##### method

`string`

##### at?

`number` = `...`

#### Returns

`number` \| `null`

***

### rank()

> **rank**(`records`, `req`, `at?`): [`ProviderRecord`](/docs/reference/providerrecord)[]

Defined in: packages/core/src/routing/ProviderRegistry.ts:440

Order providers best-first for a request. Deterministic: ties break on id.

#### Parameters

##### records

[`ProviderRecord`](/docs/reference/providerrecord)[]

##### req

[`RoutingRequirements`](/docs/reference/routingrequirements)

##### at?

`number` = `...`

#### Returns

[`ProviderRecord`](/docs/reference/providerrecord)[]

***

### recordChain()

> **recordChain**(`id`, `chain`): `void`

Defined in: packages/core/src/routing/ProviderRegistry.ts:314

#### Parameters

##### id

`string`

##### chain

###### passphrase?

`string`

###### protocolVersion?

`number`

###### version?

`string`

#### Returns

`void`

***

### recordFailure()

> **recordFailure**(`id`, `failure`): `void`

Defined in: packages/core/src/routing/ProviderRegistry.ts:235

Record a failed call and update rate-limit, circuit and capability state.

#### Parameters

##### id

`string`

##### failure

###### class

[`FailureClass`](/docs/reference/failureclass)

###### message

`string`

###### method

`string`

###### retryAfterMs?

`number`

###### startLedger?

`number`

#### Returns

`void`

***

### recordHealth()

> **recordHealth**(`id`, `health`): `void`

Defined in: packages/core/src/routing/ProviderRegistry.ts:302

Record a `getHealth` reading.

#### Parameters

##### id

`string`

##### health

###### latestLedger

`number`

###### ledgerRetentionWindow?

`number`

###### oldestLedger

`number`

#### Returns

`void`

***

### recordSuccess()

> **recordSuccess**(`id`, `obs`): `void`

Defined in: packages/core/src/routing/ProviderRegistry.ts:209

Record a successful call: latency, ledger bounds, and `getLedgers` reach evidence.

#### Parameters

##### id

`string`

##### obs

###### latencyMs

`number`

###### ledger?

[`LedgerObservation`](/docs/reference/ledgerobservation)

###### method

`string`

###### startLedger?

`number`

#### Returns

`void`

***

### snapshot()

> **snapshot**(): [`RegistrySnapshot`](/docs/reference/registrysnapshot)

Defined in: packages/core/src/routing/ProviderRegistry.ts:466

#### Returns

[`RegistrySnapshot`](/docs/reference/registrysnapshot)

***

### soonestRecovery()

> **soonestRecovery**(`at?`): `number` \| `null`

Defined in: packages/core/src/routing/ProviderRegistry.ts:456

Earliest time any currently rate-limited or circuit-open provider becomes usable again.

#### Parameters

##### at?

`number` = `...`

#### Returns

`number` \| `null`

***

### upsert()

> **upsert**(`input`): [`ProviderRecord`](/docs/reference/providerrecord)

Defined in: packages/core/src/routing/ProviderRegistry.ts:165

#### Parameters

##### input

[`ProviderInput`](/docs/reference/providerinput)

#### Returns

[`ProviderRecord`](/docs/reference/providerrecord)

***

### restore()

> `static` **restore**(`snapshot`, `config?`): `ProviderRegistry`

Defined in: packages/core/src/routing/ProviderRegistry.ts:470

#### Parameters

##### snapshot

[`RegistrySnapshot`](/docs/reference/registrysnapshot)

##### config?

[`RegistryConfig`](/docs/reference/registryconfig) = `{}`

#### Returns

`ProviderRegistry`
