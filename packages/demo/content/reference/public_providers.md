---
title: PUBLIC_PROVIDERS
description: Variable PUBLIC_PROVIDERS — @soroscope/core API reference.
generated: true
---

> `const` **PUBLIC\_PROVIDERS**: `Readonly`\<`Record`\<[`NetworkId`](/docs/reference/networkid), readonly [`CatalogEntry`](/docs/reference/catalogentry)[]\>\>

Defined in: packages/core/src/routing/catalog.ts:21

Public Stellar RPC endpoints, each confirmed with `soroscope probe`. An
entry means "answered getHealth with the right network on `verifiedAt`", not
"is production-grade". Public endpoints change; run `soroscope probe` for the
current picture. No endpoint is listed that was not seen working.
