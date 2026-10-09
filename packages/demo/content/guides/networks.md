---
title: Networks
description: Testnet and mainnet passphrases, the verified public providers, and what is different on each.
---

| Network | Passphrase | Friendbot |
|---|---|---|
| testnet | `Test SDF Network ; September 2015` | `https://friendbot.stellar.org` |
| mainnet | `Public Global Stellar Network ; September 2015` | none |

`NETWORK_PASSPHRASES` exports both. Soroscope does not know futurenet or standalone networks by name; pass `--rpc` and your own passphrase to use them.

## Verified public providers

`PUBLIC_PROVIDERS` lists the endpoints Soroscope has seen answer `getHealth` on the right network, each with the date it was last checked. **Being listed does not make a provider production-grade**: some keep one day of history, one keeps almost none, and public endpoints are rate limited. For anything that matters, add your own paid provider and let the router rank them.

```ts
import { PUBLIC_PROVIDERS, publicProviderUrls } from '@soroscope/core'

publicProviderUrls('testnet')
// ['https://soroban-testnet.stellar.org', 'https://soroban-rpc.testnet.stellar.gateway.fm']

PUBLIC_PROVIDERS.mainnet.map((p) => `${p.url} - ${p.note}`)
```

Endpoints that were tried and are *not* listed include any that returned 403 without an API key (for example `rpc.ankr.com/stellar_testnet`) and any that did not answer.

## Protocol version

`getNetwork` reports the protocol version the provider runs. The router records it per provider, and the CI check records it in the baseline so that a protocol upgrade downgrades fee failures to warnings.

## Testnet resets

Testnet is wiped periodically. Contracts you deployed disappear, and so do accounts. Anything in a test that needs a deployed contract should be redeployable by a script.
