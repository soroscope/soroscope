## Description

<!-- What does this PR do, and why is it needed? Include relevant background or design context. -->

## Type of Change

- [ ] Feature (new functionality)
- [ ] Bug fix (non-breaking change that resolves an issue)
- [ ] Documentation (changes to docs only)
- [ ] Refactor (no functional change, no API change)
- [ ] Test (adds or improves tests)
- [ ] Chore (tooling, build, dependencies, repository housekeeping)
- [ ] Breaking change (changes that would cause existing consumers to break)

## Testing

<!-- Describe the testing you performed locally. Mention which suites were run, any manual verification, and any environments touched. -->

## What I could not verify

<!-- Anything the live network would not produce on demand, providers that misbehaved, XDR arms without a real example, tests you could not run. Write "nothing" if that is true. -->

## Checklist

- [ ] `pnpm build` and `pnpm test` pass locally
- [ ] `pnpm lint` passes (it includes the ban on mocks in tests)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm check:fixtures` passes, and any new fixture was recorded by a script, not written by hand
- [ ] If I changed `packages/ci`, `core` or `invoke`: I ran `pnpm --filter @soroscope/ci bundle:action` and committed `packages/ci/action/index.cjs`
- [ ] If I edited docs: I changed `packages/demo/content` and ran `pnpm docs:gen` and `pnpm docs:test`, and did not hand-edit `docs/`
- [ ] A changeset has been added if this is a user-facing change to `core`, `invoke`, `cli`, `ci` or `mcp` (`pnpm changeset`)
- [ ] PR title follows Conventional Commits format
- [ ] Self-review of the changes has been performed

## Related Issues

<!-- Link any related issues using keywords such as "Closes #123" or "Fixes #456". -->
