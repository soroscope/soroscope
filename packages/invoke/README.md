# @soroscope/invoke

Build Soroban contract calls from a contract's own spec, and (on test networks) deploy and call a WASM build.

```ts
import { loadSpec, buildInvocationXdr } from '@soroscope/invoke'

const { spec } = await loadSpec(router, contractId)
const xdr = buildInvocationXdr({
  contractId, function: 'transfer', args: { from, to, amount: 100n },
  source: from, networkPassphrase, spec,
})
```

`buildInvocationXdr` returns an **unsigned** transaction for simulation. The source account need not exist: current RPC simulates a transaction whose source account does not exist and whose sequence is 0.

For test networks only: `fundWithFriendbot`, `deployWasm`, `sendInvocation`, `signAndSend`. These sign with a key you give them; use a throwaway.

Built on `@stellar/stellar-sdk`. Requires Node.js 22 or newer. See the [reference](https://github.com/soroscope/soroscope/blob/main/packages/demo/content/api/invoke.md).

## License

MIT
