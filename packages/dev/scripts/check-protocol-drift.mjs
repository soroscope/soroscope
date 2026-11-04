#!/usr/bin/env node
// Fails when a live Stellar network runs a newer protocol than the
// soroban-env-host the engine embeds. A host runs contracts built for its own
// protocol or older, so once the network moves ahead, `soroscope dev` refuses
// it (UnsupportedProtocolError) and the host must be bumped and the parity
// fixture re-recorded. A network *behind* the host is reported but does not
// fail the check: protocol upgrades add cost types, so the engine refuses an
// older network's configuration, but that resolves when the network upgrades.
// Run twice a week by .github/workflows/protocol-drift.yml.
//
//   node scripts/check-protocol-drift.mjs              check testnet and mainnet
//   node scripts/check-protocol-drift.mjs --offline    only print the embedded protocol
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const lock = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../engine/Cargo.lock'), 'utf8');
const host = /name = "soroban-env-host"\nversion = "(\d+)\./.exec(lock);
if (host === null) {
  console.error('soroban-env-host not found in engine/Cargo.lock');
  process.exit(2);
}
// soroban-env-host's major version is the protocol it implements.
const hostProtocol = Number(host[1]);
console.log(`embedded soroban-env-host: protocol ${hostProtocol}`);
if (process.argv.includes('--offline')) process.exit(0);

const networks = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://mainnet.sorobanrpc.com',
};

let drifted = false;
for (const [name, url] of Object.entries(networks)) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
      signal: AbortSignal.timeout(20_000),
    });
    const { result } = await res.json();
    const protocol = result?.protocolVersion;
    if (typeof protocol !== 'number') throw new Error(`no protocolVersion in ${JSON.stringify(result)}`);
    const status =
      protocol > hostProtocol
        ? 'AHEAD OF HOST'
        : protocol < hostProtocol
          ? 'behind host: the engine refuses it until that network upgrades'
          : 'in step';
    console.log(`${name}: protocol ${protocol} (${status})`);
    if (protocol > hostProtocol) drifted = true;
  } catch (e) {
    // A provider outage is not drift: say so, but do not fail the check on it.
    console.warn(`${name}: could not read the protocol (${e.message})`);
  }
}
if (drifted) {
  console.error('\nA network runs a newer protocol than the embedded host. Bump soroban-env-host and soroban-simulation in engine/Cargo.toml, rebuild, and re-record the parity fixture (packages/test-utils/scripts/record-engine-parity.mjs).');
  process.exit(1);
}
