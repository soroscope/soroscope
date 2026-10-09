---
title: XDR decoders
description: Decode Soroban and transaction XDR with no Stellar SDK, checked against the official stellar CLI.
---

All decoders take a base64 string or raw bytes, return plain data, and throw `XdrDecodeError` (with the byte `offset`) on bad input. Trailing bytes are an error. They have no dependencies.

```ts
import { decodeScVal, decodeDiagnosticEvent, scValToJs, formatScVal } from '@soroscope/core'

const value = decodeScVal('AAAAAwAAAAc=')   // { type: 'u32', value: 7 }
formatScVal(value)                           // 'u32(7)'
scValToJs(value)                             // 7
```

| Decoder | Decodes |
|---|---|
| `decodeScVal` | Any Soroban value. Integers over 32 bits are `bigint`. |
| `decodeScError` | An error value (`Error(Contract, #n)` or a host error). |
| `decodeDiagnosticEvent`, `decodeContractEvent` | Events, with the contract id as a `C...` string. |
| `decodeAuthEntry` | A `SorobanAuthorizationEntry`: who signs, and the tree of calls it covers. `describeInvocationTree()` prints it. |
| `decodeSorobanTransactionData` | Footprint and resources: `instructions`, `diskReadBytes`, `writeBytes`, `resourceFee`. |
| `decodeLedgerKey`, `canonicalLedgerKey` | Ledger keys; the canonical form is a stable single-line identity for diffing footprints. |
| `decodeLedgerEntryData` | Contract data, contract code, and TTL entries. |
| `decodeTransactionResult` | A transaction result; `partial: true` when it contains classic operations. |
| `decodeSpecEntries`, `parseWasm` | Contract specs; see [contract specs](/docs/api/contract-specs). |

`toJsonSafe(value)` converts bigints and byte arrays so a decoded value can go through `JSON.stringify`.

## Strict about the unknown

An XDR union has a fixed set of arms. When a decoder meets an arm it does not know (a form from a newer protocol), it throws `XdrUnsupportedError` naming the arm and offset. It never returns partial data.

## How they are checked

Every decoder is tested against real XDR captured from the Stellar network and against the output of `stellar xdr decode` for the same bytes, including hundreds of real diagnostic events, auth entries, footprints and ledger entries. See the repository's `packages/core/tests` and `COVERAGE.md`.

## Strkeys

`encodeAccountId`, `encodeContractId`, `decodeContractId`, `decodeAccountId` and `decodeStrkey` convert between raw bytes and `G...` / `C...` / `M...` / `B...` / `L...` forms. `decodeStrkey` checks the checksum and rejects non-canonical encodings.
