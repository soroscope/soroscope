# @soroscope/cli

The `soroscope` command: probe Stellar RPC providers, decode XDR, read contract specs, simulate calls, and check resource budgets.

```sh
npm install --global @soroscope/cli
soroscope probe --network mainnet
```

| Command | |
|---|---|
| `probe` | Latency, ledger lag, retention and real `getLedgers` reach per provider. `--format table\|json\|prometheus`, `--serve <port>` for Prometheus, `--strict` for CI. |
| `route-explain <method>` | Which provider would serve a call, and why not the others. |
| `decode <type> <base64>` | Decode `ScVal`, `DiagnosticEvent`, `SorobanAuthorizationEntry`, `SorobanTransactionData`, `LedgerKey`, ... |
| `explain <base64>` | One-line explanation of a transaction result. |
| `spec <contractId\|file.wasm>` | Functions, errors, events and types. |
| `simulate` | Simulate a call (nothing signed or sent); named contract errors. |
| `check` | The CI resource check, locally. |

Exit codes: `0` ok, `1` the verdict is a failure, `2` usage, `3` network, `4` internal.

It never accepts a secret key. See the [command line guide](https://github.com/soroscope/soroscope/blob/main/packages/demo/content/guides/cli.md).

Requires Node.js 22 or newer.

## License

MIT
