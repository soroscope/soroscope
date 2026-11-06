#!/usr/bin/env node
// Records the evidence that @soroscope/dev's engine reproduces the live MAINNET:
// calls against real contracts with real state, not a contract we deployed.
//
// For each call it records (1) Stellar RPC's own `simulateTransaction` response and
// (2) every ledger entry that simulation says the call touches, read at the same
// ledger. The fork test then loads those entries into the engine, runs the call, and
// requires the same outcome, return value, instructions, bytes, footprint and fee.
//
// Read-only: simulations send nothing and cost nothing; no key or funds are used.
// Mainnet is on protocol 29 while testnet is on 30, so this is the evidence for the
// protocol 29 host against the real network (engine-parity-protocol-29.json is
// testnet-while-on-29, and a contract we deployed).
//
// Needs: network access and `pnpm --filter @soroscope/core --filter @soroscope/testing build`.
// Usage: node packages/test-utils/scripts/record-fork-parity.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packages = resolve(here, '../..');
const out = resolve(packages, 'testing/tests/fixtures/fork-mainnet.json');
const RPC = 'https://mainnet.sorobanrpc.com';
const PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const require = createRequire(resolve(packages, 'testing/package.json'));
const sdk = require('@stellar/stellar-sdk');
const { RpcClient } = await import(resolve(packages, 'core/dist/index.js'));
const { recordFork, replayFork } = await import(resolve(packages, 'testing/dist/index.js'));

const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'; // Circle
// Two accounts holding USDC at the time of recording (found with Horizon's /accounts?asset=).
const HOLDER_A = 'GDZZZV63F63EL63XSKXE6V535JYUW2WFO6VKLYH73LCOUJCUCDRFPNIW';
const HOLDER_B = 'GDZZZCUHHZI4DROZRNCPC6LHLVQOJVYWO2Z6JLUONXRCI6SKCIARTVET';
// Soroswap's mainnet router (cross-contract calls into the factory and the pair).
const SOROSWAP_ROUTER = 'CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH';

const XLM = sdk.Asset.native().contractId(PASSPHRASE);
const USDC = new sdk.Asset('USDC', USDC_ISSUER).contractId(PASSPHRASE);
const addr = (a) => new sdk.Address(a).toScVal().toXDR('base64');
const i128 = (n) => sdk.nativeToScVal(BigInt(n), { type: 'i128' }).toXDR('base64');
const vec = (...items) => sdk.xdr.ScVal.scvVec(items.map((a) => new sdk.Address(a).toScVal())).toXDR('base64');

const calls = [
  { contractId: XLM, fn: 'name', args: [] },
  { contractId: XLM, fn: 'balance', args: [addr(HOLDER_A)] },
  { contractId: USDC, fn: 'balance', args: [addr(HOLDER_A)] },
  { contractId: USDC, fn: 'transfer', args: [addr(HOLDER_A), addr(HOLDER_B), i128(1)] },
  { contractId: SOROSWAP_ROUTER, fn: 'router_get_amounts_out', args: [i128(10_000_000), vec(XLM, USDC)] },
];

const rpc = new RpcClient({ url: RPC, timeoutMs: 60000 });
console.log(`XLM SAC  ${XLM}\nUSDC SAC ${USDC}`);
const recording = await recordFork({ rpc, networkPassphrase: PASSPHRASE, source: HOLDER_A }, calls);
const results = replayFork(recording);
for (const r of results) {
  console.log(`  ${r.call.fn.padEnd(24)} ${r.differences.length === 0 ? 'identical' : 'DIFFERS ' + JSON.stringify(r.differences.map((d) => d.field))}`);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      provenance: {
        tool: 'packages/test-utils/scripts/record-fork-parity.mjs',
        recordedAt: new Date().toISOString(),
        node: process.version,
        endpoint: RPC,
        method: 'simulateTransaction + getLedgerEntries',
        network: 'mainnet',
        note: 'Read-only simulations of real mainnet contracts, with the live ledger entries each touches, read at the same ledger.',
      },
      ...recording,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${recording.calls.length} calls to ${out}`);
