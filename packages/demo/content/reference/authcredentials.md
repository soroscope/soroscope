---
title: AuthCredentials
description: TypeAlias AuthCredentials — @soroscope/core API reference.
generated: true
---

> **AuthCredentials** = \{ `type`: `"sourceAccount"`; \} \| \{ `address`: [`ScAddress`](/docs/reference/scaddress); `nonce`: `bigint`; `signature`: [`ScVal`](/docs/reference/scval); `signatureExpirationLedger`: `number`; `type`: `"address"`; \}

Defined in: packages/core/src/decode/auth.ts:30

## Union Members

### Type Literal

\{ `type`: `"sourceAccount"`; \}

***

### Type Literal

\{ `address`: [`ScAddress`](/docs/reference/scaddress); `nonce`: `bigint`; `signature`: [`ScVal`](/docs/reference/scval); `signatureExpirationLedger`: `number`; `type`: `"address"`; \}

#### address

> **address**: [`ScAddress`](/docs/reference/scaddress)

#### nonce

> **nonce**: `bigint`

#### signature

> **signature**: [`ScVal`](/docs/reference/scval)

`void` until the entry has been signed.

#### signatureExpirationLedger

> **signatureExpirationLedger**: `number`

#### type

> **type**: `"address"`
