#!/usr/bin/env node
// Fails when a live Stellar network runs a protocol newer than every
// soroban-env-host the engine embeds. A host runs only the protocol it was
// released for (the cost model gains entries at each one), so the engine links
// one host per supported protocol and `soroscope dev` refuses a network on any
// other (UnsupportedProtocolError). When a network moves ahead, add a host for
// the new protocol in engine/Cargo.toml and src/lib.rs, rebuild, and record a
// parity fixture from that network (packages/test-utils/scripts/record-engine-parity.mjs).
//
// A network on a protocol the engine does not embed but that is not ahead (for
// example a very old one) is reported and does not fail the check.
// Run twice a week by .github/workflows/protocol-drift.yml.
//
//   node scripts/check-protocol-drift.mjs              check testnet and mainnet
//   node scripts/check-protocol-drift.mjs --offline    only print the embedded protocols
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const lock = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../engine/Cargo.lock'), 'utf8');
// soroban-env-host's major version is the protocol it implements.
const embedded = [...lock.matchAll(/name = "soroban-env-host"\nversion = "(\d+)\./g)].map((m) => Number(m[1])).sort((a, b) => a - b);
if (embedded.length === 0) {
  console.error('soroban-env-host not found in engine/Cargo.lock');
  process.exit(2);
}
const newest = embedded[embedded.length - 1];
console.log(`embedded soroban-env-host: protocol ${embedded.join(', ')}`);
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
    const status = embedded.includes(protocol)
      ? 'supported'
      : protocol > newest
        ? 'AHEAD OF EVERY EMBEDDED HOST'
        : 'no embedded host for it: the engine refuses this network';
    console.log(`${name}: protocol ${protocol} (${status})`);
    if (protocol > newest) drifted = true;
  } catch (e) {
    // A provider outage is not drift: say so, but do not fail the check on it.
    console.warn(`${name}: could not read the protocol (${e.message})`);
  }
}
if (drifted) {
  console.error('\nA network runs a newer protocol than every embedded host. Add a host for it (see the header of this script), rebuild, and record a parity fixture from that network.');
  process.exit(1);
}
