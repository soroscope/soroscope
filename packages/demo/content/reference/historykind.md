---
title: HistoryKind
description: TypeAlias HistoryKind — @soroscope/core API reference.
generated: true
---

> **HistoryKind** = `"none"` \| `"window"` \| `"deep"`

Defined in: packages/core/src/rpc/methods.ts:23

How far back a method can reach.
- `none`: no historical requirement.
- `window`: bound to the advertised retention window (`getHealth.oldestLedger`).
- `deep`: some providers serve it from a data lake far beyond the advertised
  window, so reach has to be probed rather than read from `getHealth`.
