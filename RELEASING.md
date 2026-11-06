# Releasing

**Status:** the first release (`0.1.0` of seven packages and the five engine packages) went out on 2026-11-06. `v1` is not tagged yet.

How Soroscope gets to npm, and what has to be true before the first release. This is the checklist as it was used the first time, then the routine for every release after.

## 1. The npm organisation

Every package is `@soroscope/<name>`. A scoped package can only be published by someone who owns the scope, and a scope is owned by an npm **user or organisation named `soroscope`**. So yes: create the organisation first.

1. Sign in to npm as the account that will own it, then create the organisation at <https://www.npmjs.com/org/create> named **`soroscope`**. The free plan covers public packages, which these are. (The name's availability could not be checked from here: npm refuses automated lookups. If it is taken, the scope has to change in every `package.json`, which is a much bigger job, so check before anything else.)
2. Add the other maintainers to the organisation, with the publish role, so a release does not depend on one login.
3. Turn on two-factor authentication for the organisation (Settings, Require two-factor authentication).

The platform engine packages (`@soroscope/dev-linux-x64-gnu` and the other four) are in the same scope, so one organisation covers them.

## 2. The publish credential

`release.yml` and `engine-binaries.yml` read the repository secret `NPM_TOKEN`.

- Create a **granular access token** on npm: read and write, limited to the `@soroscope` scope, and (since CI cannot answer a 2FA prompt) the option that allows it to publish with 2FA enabled. Set an expiry.
- Add it as the `NPM_TOKEN` repository secret.
- Alternative, no long-lived secret: npm _trusted publishing_ from GitHub Actions. `publish.yml` already has `id-token: write`. It needs each package's trusted publisher configured on npm after its first publish, so the first release still needs the token.

## 3. Before the first publish (done)

Fixed in the repository:

- `@soroscope/dev` and `@soroscope/differential` are no longer private, and are in the `fixed` group in `.changeset/config.json`, so all seven packages version together. (`@soroscope/cli` depends on both; with them private it would have installed nowhere.)
- `pnpm release` now runs `package-engine.mjs link --verify` before `changeset publish`. It writes the five engine packages into `@soroscope/dev`'s `optionalDependencies` at its version, and **refuses to publish anything** if any of them is not on npm at that version. A `@soroscope/dev` published without its engine packages installs and then fails the first time it is used.

Still yours to do, in this order:

1. Add the `NPM_TOKEN` repository secret (section 2).
2. Run the **Engine binaries** workflow with `publish` on. It builds the five platform packages at `@soroscope/dev`'s current version and publishes them. This must be repeated whenever the version changes, because the engine packages carry the same version as `@soroscope/dev`.
3. Run **Release** (or push to `main`). With no pending changeset it publishes every package whose version is not on npm yet, so the first release is the current `0.1.0`.
4. Tag `v1`, so `uses: soroscope/soroscope/packages/ci@v1` resolves.

Until step 2 is done, the **Release** workflow fails at `link --verify` with a message naming the missing packages. That is the check working, not a bug.

## 4. The routine

1. Land changes with a changeset (`pnpm changeset`).
2. Merging to `main` makes the _Release_ workflow open a "chore: release" pull request that bumps versions and changelogs.
3. Merging that pull request publishes every changed package. If the version changed, run **Engine binaries** with `publish` on first, or `link --verify` stops the release.
4. `publish.yml` is the manual fallback: pushing a `v*` tag builds and publishes.

Check it worked from an empty directory: `npx @soroscope/cli probe --network mainnet` prints a table.

## 5. The documentation site

The site is `packages/demo`, a Next.js app. Its content is `packages/demo/content/*.md`; `docs/` is generated from it (`pnpm docs:gen`), and `pnpm docs:test` fails if a documented import is not a real export.

To deploy on Vercel: import the repository, set the **root directory** to `packages/demo`, and leave the install command as the default (Vercel detects the pnpm workspace). Set:

| Variable               | Needed              |                                                                                |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL` | yes, for production | The site's public URL, used for canonical links, the sitemap and `robots.txt`. |
| `GROQ_API_KEY`         | no                  | Enables the docs assistant. Without it the panel says it is not configured.    |

When the packages are published, drop the "Not on npm yet" note from `content/getting-started/installation.md`.
