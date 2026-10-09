---
title: "@soroscope/invoke"
description: Build contract calls from a contract's spec, and (on test networks) deploy and call a WASM build.
---

```ts
import { buildInvocationXdr, loadSpec } from '@soroscope/invoke'
```

Built on `@stellar/stellar-sdk`. Everything that signs lives here, and only for test networks.

## Building calls (no keys)

| | |
|---|---|
| `loadSpec(rpc, contractId)` | The contract's spec in SDK form, or `spec: null` for a Stellar Asset Contract. |
| `buildInvocationXdr(options)` | An **unsigned** base64 transaction for simulation. `source` need not exist. |
| `toScVals(fn, args, spec)` | Convert named or typed arguments to Soroban values. |
| `specFromWasm(bytes)` | A spec from a local build. |

Arguments are an object of named values (needs the spec), or a list of `{ type, value }`, or ready `xdr.ScVal`s.

## Test networks only (keys)

| | |
|---|---|
| `fundWithFriendbot(url, address)` | Fund an account from a faucet. Retries transient failures. |
| `friendbotUrlFor(passphrase)` | The faucet for a test network. |
| `loadAccount(rpc, publicKey)` | Current sequence number. |
| `deployWasm({ rpc, wasm, signer, networkPassphrase })` | Upload and create a contract; returns its id and WASM hash. |
| `sendInvocation({ rpc, signer, networkPassphrase, build })` | Simulate, assemble, sign, submit one call and wait for it. |
| `signAndSend`, `assembleTransaction`, `simulateRaw` | The pieces of the above. |

`signAndSend` keeps polling through transient network errors after a transaction is submitted, since a dropped poll says nothing about whether it landed. It throws `SubmissionError` (with the hash and result XDR) if the network rejects it, it fails on chain, or it does not land in time.
