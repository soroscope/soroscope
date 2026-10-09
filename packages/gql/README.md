# @soroscope/gql

GraphQL gateway generated from a Soroban contract's spec.

| Status | |
|---|---|
| Maturity | **scaffold**: the package builds and exports its types, but has no implementation yet |
| Published | no (private until implemented) |

## Plan

Generate a GraphQL schema from a contract's `ScSpecEntry` list. Read-only functions become queries resolved by simulation; events become paginated queries.

See the [roadmap](../../README.md#roadmap).
