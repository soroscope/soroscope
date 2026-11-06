#!/usr/bin/env node
// Records what several real mainnet RPC providers answer to the same simulated calls,
// so the differential comparison is tested on real responses, not invented ones.
//
// Read-only: simulations send nothing and cost nothing; no key or funds are used.
// Includes a state-dependent call (a DEX quote, which moves with every trade) alongside
// a stable one, because that is where providers answering at different ledgers can differ.
//
// Needs: network access and `pnpm --filter @soroscope/core build`.
// Usage: node packages/test-utils/scripts/record-differential.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packages = resolve(here, '../..');
const out = resolve(packages, 'differential/tests/fixtures/provider-answers.json');
const PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const SOURCE = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const SOROSWAP_ROUTER = 'CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH';

const require = createRequire(resolve(packages, 'testing/package.json')); // for @stellar/stellar-sdk
const sdk = require('@stellar/stellar-sdk');
const { RpcClient, publicProviderUrls } = await import(resolve(packages, 'core/dist/index.js'));

const XLM = sdk.Asset.native().contractId(PASSPHRASE);
const USDC = new sdk.Asset('USDC', SOURCE).contractId(PASSPHRASE);
const i128 = (n) => sdk.nativeToScVal(BigInt(n), { type: 'i128' });
const vec = (...a) => sdk.xdr.ScVal.scvVec(a.map((x) => new sdk.Address(x).toScVal()));
const envelope = (contract, fn, args) =>
  new sdk.TransactionBuilder(new sdk.Account(SOURCE, '0'), { fee: '100', networkPassphrase: PASSPHRASE })
    .addOperation(sdk.Operation.invokeContractFunction({ contract, function: fn, args }))
    .setTimeout(0)
    .build()
    .toXDR();

const calls = [
  { name: 'XLM name()', transaction: envelope(XLM, 'name', []) },
  { name: 'Soroswap quote: 1 XLM -> USDC', transaction: envelope(SOROSWAP_ROUTER, 'router_get_amounts_out', [i128(10_000_000), vec(XLM, USDC)]) },
  { name: 'USDC balance of the issuer\'s own holder', transaction: envelope(USDC, 'balance', [new sdk.Address(SOURCE).toScVal()]) },
];

const providers = publicProviderUrls('mainnet');
console.log(`${providers.length} providers`);
const recorded = [];
for (const call of calls) {
  const answers = await Promise.all(
    providers.map(async (provider) => {
      const started = performance.now();
      try {
        const raw = await new RpcClient({ url: provider, timeoutMs: 30000 }).call('simulateTransaction', { transaction: call.transaction });
        return { provider, latencyMs: Math.round(performance.now() - started), raw };
      } catch (e) {
        return { provider, latencyMs: Math.round(performance.now() - started), failure: String(e.message ?? e).slice(0, 300) };
      }
    }),
  );
  recorded.push({ ...call, answers });
  const ledgers = answers.filter((a) => a.raw).map((a) => a.raw.latestLedger);
  console.log(`  ${call.name}: ${answers.filter((a) => a.raw).length}/${answers.length} answered, ledgers ${[...new Set(ledgers)].join(', ')}`);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      provenance: {
        tool: 'packages/test-utils/scripts/record-differential.mjs',
        recordedAt: new Date().toISOString(),
        node: process.version,
        network: 'mainnet',
        method: 'simulateTransaction',
        note: 'The same simulated calls sent to every public mainnet provider in the catalogue, at the same moment.',
      },
      calls: recorded,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${out}`);
