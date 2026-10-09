# @soroscope/ci

Fail a pull request when a Soroban contract call gets more expensive.

It simulates the calls listed in `soroscope.config.json`, compares instructions, disk reads, writes, resource fee and the **ledger footprint** with a baseline you commit, and comments on the pull request.

```yaml
- uses: soroscope/soroscope/packages/ci@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

- **Mode A** measures a deployed contract. No keys.
- **Mode B** deploys your compiled WASM to **testnet** with a throwaway key funded by friendbot, then measures it. This is what catches regressions in code that is not deployed yet. It refuses to run on mainnet.

The Action ships as one committed bundle (`action/index.cjs`) so it runs without an install; a workflow fails if the bundle drifts from source.

Full guide: [CI resource checks](https://github.com/soroscope/soroscope/blob/main/packages/demo/content/guides/ci-resource-checks.md). Config reference: [CI config](https://github.com/soroscope/soroscope/blob/main/packages/demo/content/api/ci-config.md).

## Library use

```ts
import { loadConfig, runChecks, renderMarkdown } from '@soroscope/ci'

const { report } = await runChecks({ loaded: loadConfig('soroscope.config.json') })
console.log(renderMarkdown(report))
```

The same engine backs `soroscope check`.

## Known limits

- Simulation costs depend on ledger state; measure against state you control.
- Current RPC responses report no memory figure, so memory is not gated.
- The pull-request comment code is not covered by an automated test against GitHub's API; the rest of the Action is run end to end.

## License

MIT
