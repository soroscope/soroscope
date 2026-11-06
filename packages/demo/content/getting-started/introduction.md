---
title: Introduction
description: Soroscope is developer tooling for Stellar and Soroban, built around one idea - know what each RPC provider can really do before you rely on it.
---

Soroscope is a set of developer tools for Stellar and Soroban that share one core. The core knows, for every RPC provider you use, how fast it is, how far behind the network it is, how much history it keeps, and how it fails. Everything else is built on that.

## What you get

| Tool | What it does |
|---|---|
| [`@soroscope/core`](/docs/api/router) | A router that sends each call only to a provider that can serve it; XDR decoders; contract specs; decoded simulation reports. Zero runtime dependencies. |
| [`@soroscope/cli`](/docs/guides/cli) | `soroscope probe`, `decode`, `spec`, `simulate`, `check`. |
| [`@soroscope/ci`](/docs/guides/ci-resource-checks) | A GitHub Action that fails a pull request when a contract call gets more expensive. |
| [`@soroscope/mcp`](/docs/guides/mcp-server) | A read-only MCP server so AI agents can check RPC health, decode XDR and simulate calls. |
| [`@soroscope/invoke`](/docs/api/invoke) | Build contract calls from a contract's own spec, with named arguments. |
| [`@soroscope/dev`](/docs/guides/local-development) | `soroscope dev`: run a contract in-process, hot-swap it on every save, and call it from a prompt with the network's real costs. Preview. |
| [`@soroscope/testing`](/docs/guides/fork-testing) | Replay calls against recorded live mainnet state, offline, and check the engine against the network. Preview. |
| [`@soroscope/differential`](/docs/guides/comparing-providers) | `simulate --compare`: one call on every provider, and where they disagree. Preview. |

## What it is for

- **You depend on RPC providers.** Providers differ a lot, and in ways their health endpoint does not tell you. See [what providers really do](/docs/guides/rpc-provider-notes).
- **You want a failed call explained**, not a base64 blob: which contract raised which error, with the name the contract gave it.
- **You want to know when a change makes a contract call more expensive** before it ships, not after.
- **You build with AI agents** and want them to look at the chain without being able to spend anything.

## What it is not

Soroscope does not manage wallets, keys or accounts, and nothing in the router, CLI, or MCP server signs or submits a transaction. The only signing in the project is in `@soroscope/invoke`, used by the CI check to deploy your build to **testnet** with a throwaway key.

## Status

Soroscope is pre-1.0. The packages above are implemented and tested against the live Stellar network. The three marked *Preview* work and are tested, and their edges are listed on their pages: the in-process engine is checked against live testnet and mainnet on the calls recorded, and a new kind of call is not known to match until it has been compared. A GraphQL gateway, a token and `stellar.toml` inspector and a VS Code extension are frozen. The [roadmap](https://github.com/soroscope/soroscope#roadmap) says which are which.
