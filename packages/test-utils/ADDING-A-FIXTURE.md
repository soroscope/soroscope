# Adding a fixture-backed test

Soroscope does not mock the network, and it does not let you write XDR by hand. A test gets its input by **recording what the live network returns**, and its expected value from **an independent implementation** (the official `stellar` CLI). This page walks through the most common case: a decoder handles a value the corpus does not yet contain.

Read the rule first: [the testing rule in CONTRIBUTING.md](../../CONTRIBUTING.md#the-testing-rule-nothing-is-mocked). For where the pieces live, see [ARCHITECTURE.md](../../ARCHITECTURE.md#how-the-tests-are-organised).

## What you need

- Node.js 22 and pnpm 10, with `pnpm install` and `pnpm build` done.
- The [`stellar` CLI](https://developers.stellar.org/docs/tools/cli). The recorder shells out to it, both to build transactions and to produce the oracle output. The corpus was recorded with `stellar 25.2.0`; a newer protocol can have union arms an older CLI cannot decode.
- Network access to `soroban-testnet.stellar.org`.
- Rust with the `wasm32v1-none` target, only if you change the fixture contract.

The recorders use throwaway keys in a temporary directory. They never read your own `stellar keys`.

## Step 1: find the gap

```sh
node packages/test-utils/scripts/coverage-matrix.mjs
```

This rewrites `packages/core/tests/fixtures/COVERAGE.md`. Rows marked **not covered** are union arms (`timepoint`, `duration`, `u256`, `i256`, several ledger key kinds and so on) that no real blob in the corpus contains. For those, the decoder exists but has never been compared with the official tool.

## Step 2: make the network produce an example

You cannot invent the blob. You have to make the network emit one. Two ways:

**Simulate a call that returns the value.** `record-soroban.mjs` builds a transaction with `stellar contract invoke --build-only` and sends it to `simulateTransaction`. The calls it records are the `cases` array near the top of the file, against the native asset contract. Add a case:

```js
{ name: 'balance of an address with no trustline', fn: 'balance', args: ['--id', OTHER] },
```

Each case has a display `name`, the contract function `fn`, and the CLI arguments `args`.

For a value the native asset contract cannot return, you need a contract that can. The fixture contract in `packages/test-utils/fixture-contract/src/lib.rs` is the place to add a function that returns it. After changing it, rebuild and redeploy (see "After a testnet reset" in [CONTRIBUTING.md](../../CONTRIBUTING.md#running-the-tests)); the deployed contract id in `fixtures/fixture-contract.json` changes.

**Find it on the live ledger.** The recorder also pulls recent events, transactions and ledger entries. If the value occurs naturally (a trustline key, a system event), a re-record may pick it up without any code change. Check the coverage matrix afterwards.

## Step 3: record

```sh
node packages/test-utils/scripts/record-soroban.mjs
```

Every blob the recorder sees goes through `addItem(type, base64, source)`, which runs `stellar xdr decode --type <type> --output json` on it and stores the result next to the blob:

```json
{ "type": "ScVal", "b64": "AAAA...", "source": "simulate:name:return", "oracle": { "symbol": "native" }, "oracleError": null }
```

`oracle` is what the official tool printed. If the CLI cannot decode a blob, `oracle` is `null` and `oracleError` says why; the test suite requires every item to have an oracle, so that is a failure to investigate, not to skip.

**Important: recording is not additive.** The script rebuilds `soroban-xdr.json` from scratch and overwrites it. A re-record replaces the whole corpus with a new snapshot of the live network, so the diff in your pull request will be large and will mostly be unrelated blobs. That is expected today. In the pull request, say which rows of the coverage matrix moved and why the rest of the diff is churn. (Making the recorder merge instead of overwrite would be a good first contribution; see the issue list.)

## Step 4: update the coverage matrix and check provenance

```sh
node packages/test-utils/scripts/coverage-matrix.mjs
pnpm check:fixtures
```

`check:fixtures` fails if any fixture file under a package's `tests/fixtures` lacks a `provenance` block with a `tool` and a `recordedAt`. The recorder writes one for you. If you hand-edit a fixture, this is the check that will fail, and so will review.

## Step 5: write the test

You usually do not need to write a new test. `packages/core/tests/unit/decoders.oracle.test.ts` runs every item of each type through the matching decoder and compares the result with the oracle:

```ts
expect(toOracle(decode(item.b64) as never)).toEqual(item.oracle);
```

A newly recorded item is covered automatically. What can need work is the mapping in `packages/core/tests/helpers/oracle.ts`, which turns Soroscope's decoded tree into the JSON shape `stellar xdr decode` prints. A new arm may need a new `case` there. That file is test-only and is not part of the library.

Run the suite:

```sh
pnpm --filter @soroscope/core test
```

If the new item fails, the decoder and the official tool disagree. That is the useful outcome: fix the decoder in `packages/core/src/decode`, not the oracle.

## Step 6: say what you could not verify

In the pull request description, state:

- which fixtures you recorded, on which network and ledger (it is in the `provenance` block)
- which `stellar` CLI version produced the oracle
- anything the network would not produce on demand. If you could not get an example of an arm, leave it **not covered** in `COVERAGE.md`. Do not write one by hand.

## If testnet has been reset

Recorded fixtures are still valid blobs, but anything that points at a live object (the fixture contract id, a ledger sequence) no longer exists. Redeploy the contract and re-record:

```sh
(cd packages/test-utils/fixture-contract && stellar contract build)
node packages/test-utils/scripts/deploy-fixture-contract.mjs
node packages/test-utils/scripts/record-rpc.mjs
node packages/test-utils/scripts/record-soroban.mjs
```
