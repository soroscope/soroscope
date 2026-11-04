#!/usr/bin/env node
// Records the evidence that @soroscope/dev's in-process engine computes what the
// network computes. It:
//
//   1. builds the fixture contract twice in a temporary copy: v1 as committed, and
//      v2 with two functions appended (`version` -> 2, and `build_id`, a constant
//      unique to this recording so its code hash is new on testnet and therefore
//      not archived);
//   2. records the network's CONFIG_SETTING entries (fees, cost model, TTLs);
//   3. deploys v2 to TESTNET with a THROWAWAY key funded by friendbot;
//   4. records the live `simulateTransaction` response for a set of calls.
//
// The fixture embeds both WASM files, so the tests run the exact bytes the live
// network ran, and need neither Rust nor a network.
//
// Needs: the `stellar` CLI, Rust with wasm32v1-none, network access, and
// `pnpm --filter @soroscope/invoke build` (for deployWasm).
//
// Usage: node packages/test-utils/scripts/record-engine-parity.mjs
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packages = resolve(here, '../..');
const out = resolve(packages, 'dev/tests/fixtures/engine-parity.json');
const RPC = 'https://soroban-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';

const require = createRequire(resolve(packages, 'invoke/package.json'));
const sdk = require('@stellar/stellar-sdk');
const { RpcClient } = await import(resolve(packages, 'core/dist/index.js'));
const { deployWasm, fundWithFriendbot } = await import(resolve(packages, 'invoke/dist/index.js'));

const buildId = BigInt(Date.now());
const V2_PATCH = `
    /// Added by record-engine-parity.mjs: proves a hot swap took effect.
    pub fn version(_env: Env) -> u32 {
        2
    }

    /// Added by record-engine-parity.mjs: unique per recording, so v2's code hash is new.
    pub fn build_id(_env: Env) -> u64 {
        ${buildId}
    }
`;

function build(dir) {
  execFileSync('stellar', ['contract', 'build'], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], timeout: 900000 });
  return readFileSync(resolve(dir, 'target/wasm32v1-none/release/soroscope_fixture_contract.wasm'));
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json();
  if (body.error !== undefined) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function configKey(id) {
  const b = Buffer.alloc(8);
  b.writeInt32BE(8, 0); // LedgerEntryType CONFIG_SETTING
  b.writeInt32BE(id, 4);
  return b.toString('base64');
}

const work = mkdtempSync(resolve(tmpdir(), 'soroscope-parity-'));
try {
  const src = resolve(packages, 'test-utils/fixture-contract');
  for (const v of ['v1', 'v2']) {
    for (const f of ['Cargo.toml', 'Cargo.lock', 'src']) cpSync(resolve(src, f), resolve(work, v, f), { recursive: true });
  }
  const lib = resolve(work, 'v2/src/lib.rs');
  const text = readFileSync(lib, 'utf8');
  const anchor = '    pub fn work(';
  if (!text.includes(anchor)) throw new Error('fixture contract changed: cannot find `pub fn work(` to patch v2');
  writeFileSync(lib, text.replace(anchor, `${V2_PATCH}\n${anchor}`));
  console.log('building v1 and v2...');
  const v1 = build(resolve(work, 'v1'));
  const v2 = build(resolve(work, 'v2'));

  const configResult = await rpc('getLedgerEntries', { keys: Array.from({ length: 17 }, (_, i) => configKey(i)) });
  const latest = await rpc('getLatestLedger');

  const kp = sdk.Keypair.random();
  await fundWithFriendbot(FRIENDBOT, kp.publicKey());
  const client = new RpcClient({ url: RPC, timeoutMs: 60000 });
  console.log('deploying v2 to testnet...');
  const deployed = await deployWasm({ rpc: client, wasm: v2, signer: kp, networkPassphrase: PASSPHRASE });

  const { nativeToScVal, xdr, Address } = sdk;
  const u32 = (n) => nativeToScVal(n, { type: 'u32' });
  const i128 = (n) => nativeToScVal(n, { type: 'i128' });
  const calls = [
    ['work', [u32(10)]],
    ['work', [u32(5000)]],
    ['touch', [u32(3)]],
    ['emit', [u32(4)]],
    ['version', []],
    ['put', [xdr.ScVal.scvSymbol('k'), i128(42n)]],
    ['put_temp', [xdr.ScVal.scvSymbol('k'), i128(42n)]],
    ['balance', [new Address(kp.publicKey()).toScVal()]],
    ['fail_with', [u32(2)]],
  ];
  const account = await new sdk.rpc.Server(RPC).getAccount(kp.publicKey());
  const recorded = [];
  for (const [fn, args] of calls) {
    const tx = new sdk.TransactionBuilder(account, { fee: sdk.BASE_FEE, networkPassphrase: PASSPHRASE })
      .addOperation(new sdk.Contract(deployed.contractId).call(fn, ...args))
      .setTimeout(300)
      .build();
    const live = await rpc('simulateTransaction', { transaction: tx.toXDR() });
    recorded.push({ fn, args: args.map((a) => a.toXDR('base64')), live });
    console.log(`  ${fn}: ${live.error === undefined ? `fee ${live.minResourceFee}` : 'error'}`);
  }

  const stellarCli = execFileSync('stellar', ['--version'], { encoding: 'utf8' }).split('\n')[0];
  const fixture = {
    provenance: {
      tool: 'packages/test-utils/scripts/record-engine-parity.mjs',
      recordedAt: new Date().toISOString(),
      node: process.version,
      stellarCli,
      endpoint: RPC,
      method: 'simulateTransaction',
      note: 'v1 is the committed fixture contract; v2 is it plus the functions in v2Patch. Both built with `stellar contract build`. v2 deployed with a throwaway friendbot key.',
    },
    network: 'testnet',
    networkPassphrase: PASSPHRASE,
    protocolVersion: latest.protocolVersion,
    latestLedger: configResult.latestLedger,
    configEntries: configResult.entries.map((e) => ({ xdr: e.xdr, lastModifiedLedgerSeq: e.lastModifiedLedgerSeq })),
    v2Patch: V2_PATCH,
    v1Wasm: v1.toString('base64'),
    v2Wasm: v2.toString('base64'),
    live: { contractId: deployed.contractId, wasmHash: deployed.wasmHash, invoker: kp.publicKey() },
    calls: recorded,
  };
  writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${recorded.length} calls to ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
