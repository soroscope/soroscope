---
title: FailureClass
description: TypeAlias FailureClass — @soroscope/core API reference.
generated: true
---

> **FailureClass** = `"rate_limited"` \| `"server"` \| `"timeout"` \| `"network"` \| `"protocol"` \| `"auth"` \| `"misconfigured"` \| `"out_of_retention"` \| `"unsupported_method"` \| `"invalid_request"`

Defined in: packages/core/src/rpc/classify.ts:13

What kind of failure a request hit. The router uses the class, not the raw
error, to decide whether to fail over, back off, or give up.
