---
title: MCP server
description: Give an AI agent read-only access to Stellar RPC health, XDR decoding and Soroban simulation.
---

`@soroscope/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio. It lets an agent answer "why did this fail?" and "which provider should I use?" without being able to spend anything.

## Register it

For a client that reads an MCP config file:

```json
{
  "mcpServers": {
    "soroscope": { "command": "npx", "args": ["-y", "@soroscope/mcp"] }
  }
}
```

## The tools

| Tool | Use |
|---|---|
| `rpc_status` | Probe providers: latency, lag, retention, `getLedgers` reach. |
| `rpc_route_explain` | Which provider would serve a call, and why not the others. |
| `decode_xdr` | Decode base64 XDR (`ScVal`, `DiagnosticEvent`, `SorobanAuthorizationEntry`, `SorobanTransactionData`, `LedgerKey`, `LedgerEntryData`, `TransactionResult`, ...). |
| `explain_error` | Explain a transaction result, or name a contract error code from the contract's spec. |
| `get_contract_spec` | A deployed contract's functions, errors, events and types. |
| `simulate_invocation` | Simulate a call with named arguments; decoded result or decoded contract error. |
| `simulate_transaction` | Simulate a base64 transaction envelope. |
| `get_transaction` | Look up a transaction and explain it. |
| `get_events` | Recent contract events, decoded. |
| `get_ledger_entries` | Read ledger entries by key, decoded. |
| `check_baseline` | Run a `soroscope.config.json` check from the workspace (never configs that deploy). |

Every tool is annotated read-only.

## What it will not do

- **No signing, sending, key generation or funding.** There is no such tool.
- **Secret keys are refused.** If a tool argument anywhere contains something that decodes as a Stellar secret seed (`S...`), the call fails with a message telling the model to remove it, and the key is never echoed back.
- **Custom RPC URLs are off** unless the operator starts the server with `SOROSCOPE_MCP_ALLOW_CUSTOM_RPC=1`. Even then they must be `https`, carry no credentials, and resolve only to public addresses, so a model cannot be steered into probing internal services.
- **`check_baseline` stays inside the workspace** (the directory the server started in) and refuses configs that would deploy contracts.
- **Output is capped.** Large results are cut and flagged.

## A note on trust

Strings inside decoded contract values and events come from the chain, and anyone can put anything there. The tool descriptions say so, and results are returned as quoted JSON data. Still, treat text inside an event the way you would treat text inside a web page you fetched.
