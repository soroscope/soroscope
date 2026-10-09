# @soroscope/mcp

A read-only [MCP](https://modelcontextprotocol.io) server for Stellar and Soroban. An agent can check RPC health, decode XDR, read contract specs and simulate calls. It cannot sign, send or fund anything: there is no such tool.

```json
{ "mcpServers": { "soroscope": { "command": "npx", "args": ["-y", "@soroscope/mcp"] } } }
```

Tools: `rpc_status`, `rpc_route_explain`, `decode_xdr`, `explain_error`, `get_contract_spec`, `simulate_invocation`, `simulate_transaction`, `get_transaction`, `get_events`, `get_ledger_entries`, `check_baseline`. Every one is annotated read-only.

## Safety

- Any input containing a Stellar secret seed (`S...`) is refused, and the key is not echoed back.
- Custom RPC URLs are off unless the operator sets `SOROSCOPE_MCP_ALLOW_CUSTOM_RPC=1`; then they must be `https`, carry no credentials and resolve to public addresses only.
- `check_baseline` stays inside the working directory and refuses configs that deploy contracts.
- Output is capped and flagged when truncated.
- Text inside decoded contract values comes from the chain and is untrusted.

stdout carries the protocol; diagnostics go to stderr. Requires Node.js 22 or newer.

Full guide: [MCP server](https://github.com/soroscope/soroscope/blob/main/packages/demo/content/guides/mcp-server.md).

## License

MIT
