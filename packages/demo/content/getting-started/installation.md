---
title: Installation
description: Install the Soroscope packages you need.
---

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
