# @soroscope/test-utils (private)

Fixture recorders and the fixture contract behind Soroscope's tests. **Nothing here fakes a network.** Every fixture is a real response captured from a live Stellar network, with a `provenance` block saying how.

| Script | Records |
|---|---|
| `scripts/record-rpc.mjs` | `getHealth` from every catalogued provider, and real error responses (out-of-range ledgers, 404, 403, unknown method). |
| `scripts/record-soroban.mjs` | Real Soroban XDR (simulations, ledger entries, events, transactions, three real contracts' WASM) and the `stellar xdr decode` reading of each blob, as the independent oracle. |
| `scripts/deploy-fixture-contract.mjs` | Deploys `fixture-contract/` to testnet with a throwaway key in a temporary config directory. Never touches your own `stellar keys`. |
| `scripts/coverage-matrix.mjs` | Writes `packages/core/tests/fixtures/COVERAGE.md`: which XDR union arms the corpus has, and which it does not. |
| `scripts/check-fixtures.mjs` | Fails if a committed fixture has no provenance. |

`fixture-contract/` is a small Soroban contract with named errors, auth, typed events, all three storage durabilities, a panic, and two cost knobs: `work(n)` burns CPU in proportion to `n` (written so the compiler cannot collapse the loop; an earlier plain sum was optimised to a constant), and `touch(n)` writes `n` entries.

Needs the `stellar` CLI and, to rebuild the contract, Rust with the `wasm32v1-none` target.

If a test needs a case the network will not produce on demand, record one. Do not write one by hand.
