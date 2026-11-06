---
title: Installation
description: Install the Soroscope packages you need.
---

> **Not on npm yet.** The commands below are what installing will look like once the first release is out. Until then, use [From source](#from-source). This page will drop this note when `npm view @soroscope/core` resolves.

Soroscope needs **Node.js 20 or newer** (22 or newer for `@soroscope/invoke`, `@soroscope/ci` and `@soroscope/mcp`, because `@stellar/stellar-sdk` requires it).

## Library

```sh
npm install @soroscope/core
```

`@soroscope/core` has no runtime dependencies. It uses the platform's `fetch`.

## Command line

```sh
npm install --global @soroscope/cli
soroscope probe --network testnet
```

Or run it without installing: `npx @soroscope/cli probe`.

## GitHub Action

Reference the Action from a workflow, no install needed. See [CI resource checks](/docs/guides/ci-resource-checks).

## MCP server

```sh
npx @soroscope/mcp
```

See [MCP server](/docs/guides/mcp-server) for how to register it with an agent.

## From source

```sh
git clone https://github.com/soroscope/soroscope
cd soroscope
pnpm install
pnpm build
pnpm test
```

`pnpm test:integration` runs the live-network suites against Stellar testnet.

### The local engine (`soroscope dev`)

`soroscope dev` and `@soroscope/testing` need a native engine, a Rust library. From source:

```sh
pnpm --filter @soroscope/dev build:engine   # needs Rust; the first build takes 8-20 minutes
pnpm --filter @soroscope/dev test:engine
```

Prebuilt binaries for Linux (x64, arm64), macOS (x64, arm64) and Windows x64 build and pass in CI; they are not published yet. `SOROSCOPE_ENGINE_PATH` points at a binary built elsewhere.
