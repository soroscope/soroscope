#!/usr/bin/env node
// Deploys the Soroscope fixture contract to Stellar testnet and records where it lives.
//
// Uses a THROWAWAY key funded by the public friendbot, kept in a temporary config
// directory that is deleted afterwards. It never touches your own `stellar keys`.
// Run again after a testnet reset (testnet is wiped periodically).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const wasmPath = resolve(root, 'fixture-contract/target/wasm32v1-none/release/soroscope_fixture_contract.wasm');
const out = resolve(root, 'fixtures/fixture-contract.json');
const cfg = mkdtempSync(resolve(tmpdir(), 'soroscope-deploy-'));

// Friendbot returns before every RPC node has seen the new account; retry briefly on that.
async function withRetry(fn, attempts = 6) {
  for (let i = 1; ; i += 1) {
    try {
      return fn();
    } catch (err) {
      const text = String(err.stderr || err.message);
      if (i >= attempts || !/Account not found|not found/i.test(text)) throw err;
      console.log(`waiting for the funded account to appear (${i}/${attempts})...`);
      await new Promise((r) => setTimeout(r, 6000));
    }
  }
}

const stellar = (args) =>
  execFileSync('stellar', ['--config-dir', cfg, ...args], { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

try {
  const wasm = readFileSync(wasmPath);
  stellar(['keys', 'generate', 'deployer', '--fund', '--network', 'testnet']);
  const deployer = stellar(['keys', 'address', 'deployer']);
  console.log('throwaway deployer:', deployer);

  const lines = (await withRetry(() => stellar(['contract', 'deploy', '--wasm', wasmPath, '--source-account', 'deployer', '--network', 'testnet']))).split('\n');
  const contractId = lines[lines.length - 1].trim();
  console.log('deployed:', contractId);

  await withRetry(() => stellar(['contract', 'invoke', '--id', contractId, '--source-account', 'deployer', '--network', 'testnet', '--', 'init', '--admin', deployer]));
  console.log('initialised with the deployer as admin');

  writeFileSync(
    out,
    JSON.stringify(
      {
        provenance: {
          tool: 'packages/test-utils/scripts/deploy-fixture-contract.mjs',
          recordedAt: new Date().toISOString(),
          stellarCli: stellar(['--version']).split('\n')[0],
        },
        network: 'testnet',
        contractId,
        deployer,
        wasmSha256: createHash('sha256').update(wasm).digest('hex'),
        wasmBytes: wasm.length,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('wrote', out);
} finally {
  rmSync(cfg, { recursive: true, force: true });
}
