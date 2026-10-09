# Contributing to Soroscope

Thank you for your interest in contributing to Soroscope: developer tooling for Stellar and Soroban. Contributions of all kinds are welcome, including bug reports, fixes, new features, documentation improvements, and refactors.

This document explains how to set up the project locally, the conventions we follow, and the process for submitting changes.

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behaviour through the channel listed in that document.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or newer (pinned in `.nvmrc`)
- [pnpm](https://pnpm.io/) 10.x
- To record fixtures or rebuild the fixture contract: the [`stellar` CLI](https://developers.stellar.org/docs/tools/cli) and Rust with the `wasm32v1-none` target

## Local Setup

```bash
git clone https://github.com/soroscope/soroscope.git
cd soroscope
pnpm install
pnpm build
pnpm test
```

## Project Structure

Soroscope is a pnpm workspace under `packages/`. `core` is the foundation (zero runtime dependencies); `cli`, `ci`, `mcp` and `invoke` build on it. `test-utils` (private) holds fixture recorders and the fixture contract. `gql`, `dev`, `testing`, `inspect`, `differential` and `vscode` are scaffolds that say so in their READMEs. `demo` is the documentation site; its `content/` is the source of truth for the docs, and `docs/` is generated from it.

Keep `core` free of runtime dependencies. If it needs something the platform lacks, that is a design question to raise first.

## The testing rule: nothing is mocked

This is the project's central convention, and a lint rule enforces part of it.

- **Do not** use `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.stubGlobal` or `vi.stubEnv` in tests. `pnpm lint` fails if you do.
- **Do not** write XDR, RPC responses or provider behaviour by hand.
- **Do** record what the real network returns, with a script, into a fixture that carries a `provenance` block. `pnpm check:fixtures` fails if one does not. See [`packages/test-utils`](./packages/test-utils/README.md).
- **Do** compare decoders with an independent implementation: `stellar xdr decode` for XDR, `stellar contract info` for specs.
- **Do** test networking code against real endpoints, including real failures (an unresolvable host, a closed port, a 1 ms timeout, an out-of-range ledger).
- If the network will not produce a case on demand, **record it when it does** or write the gap into `packages/core/tests/fixtures/COVERAGE.md`. Do not invent it.
- When a test can only vary one input, use a real contract with a real difference (the fixture contract's `work(n)` and `touch(n)`), not an edited number.
- Say plainly in the pull request what you could not verify.

Pure logic with a deliberately controlled input (for example the comparison thresholds) is fine to test with values derived from a real measurement. Say so in the test.

## Pull Request Process

1. **Fork or branch from `main`.** External contributors should fork and open a pull request from a feature branch. Maintainers may push branches directly.
2. **Use the branch naming convention:** `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `test/*` or `chore/*`.
3. **Follow Conventional Commits.** Enforced in CI by commitlint, for example:
   ```
   feat(core): exclude providers that lag the network from state-reading calls
   fix(ci): alias the deployer address inside footprint keys
   docs: explain why getLedgers reach is probed
   ```
4. **Add a changeset for any user-facing change** to a published package (`core`, `invoke`, `cli`, `ci`, `mcp`):
   ```bash
   pnpm changeset
   ```
   These five are versioned together.
5. **Open a pull request** and fill out the template. Link issues with `Closes #N`.
6. **Required checks:** the CI workflow (build, type check, lint, fixture provenance, unit tests). The live-network workflow is informative, not required, because it depends on public infrastructure.
7. **Review.** One maintainer approval is required. See [GOVERNANCE.md](./GOVERNANCE.md).

## Running the Tests

```bash
pnpm test                 # unit tests: real recorded fixtures, no network
pnpm test:integration     # live testnet: routing, probe, CLI, Action, MCP, CI engine
pnpm test:coverage        # unit-suite coverage
pnpm lint                 # includes the no-mocks rule
pnpm check:fixtures
```

The integration suites need network access and may flake when public RPC providers are degraded. If one fails, re-run it before assuming your change broke it, and report a provider that misbehaves.

If testnet has been reset and the fixture contract is gone, redeploy it:

```bash
(cd packages/test-utils/fixture-contract && stellar contract build)
node packages/test-utils/scripts/deploy-fixture-contract.mjs
```

The recorders use throwaway keys in a temporary directory; they never touch your own `stellar keys`.

## Documentation

Edit pages in `packages/demo/content`. Then:

```bash
pnpm docs:gen     # error reference, API reference, and docs/ from content
pnpm docs:test    # every import in a documented example must be a real export
```

Examples that import from `@soroscope/*` are checked against the packages' real exports.

## The GitHub Action bundle

The Action runs from a committed bundle, `packages/ci/action/index.cjs`. After changing `packages/ci`, `core` or `invoke`, run `pnpm --filter @soroscope/ci bundle:action` and commit the result. A workflow fails if it is stale.

## Where to Ask Questions

- For general questions and design discussion, use [GitHub Discussions](https://github.com/soroscope/soroscope/discussions).
- For everything else, see [SUPPORT.md](./SUPPORT.md), which lists the right channel for each kind of request.
- Do not file security vulnerabilities as public issues. Follow [SECURITY.md](./SECURITY.md) instead.
