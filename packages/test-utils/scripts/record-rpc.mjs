#!/usr/bin/env node
// Records REAL responses from live Stellar RPC providers into
// packages/core/tests/fixtures. Every fixture carries a provenance block
// (endpoint, request, capture time). Nothing is hand-written or simulated.
//
// Usage: node scripts/record-rpc.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../core/tests/fixtures');
mkdirSync(outDir, { recursive: true });

const SDF_TESTNET = 'https://soroban-testnet.stellar.org';
const PROVIDERS = {
  testnet: [SDF_TESTNET, 'https://soroban-rpc.testnet.stellar.gateway.fm'],
  mainnet: [
    'https://mainnet.sorobanrpc.com',
    'https://soroban-rpc.mainnet.stellar.gateway.fm',
    'https://rpc.lightsail.network',
    'https://soroban-rpc.creit.tech',
    'https://archive-rpc.lightsail.network',
  ],
};

async function rpc(url, method, params, timeoutMs = 30000) {
  const body = { jsonrpc: '2.0', id: 1, method, ...(params === undefined ? {} : { params }) };
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    const headers = {};
    for (const [k, v] of res.headers.entries()) {
      if (/^(retry-after|content-type|server|x-ratelimit|ratelimit)/i.test(k)) headers[k] = v;
    }
    return { url, request: body, httpStatus: res.status, headers, bodyText: text.slice(0, 2000), capturedAtMs: started };
  } catch (err) {
    return { url, request: body, networkError: String(err), capturedAtMs: started };
  }
}

const meta = {
  tool: 'packages/test-utils/scripts/record-rpc.mjs',
  node: process.version,
  recordedAt: new Date().toISOString(),
};

// ---- getHealth from every catalogued provider ---------------------------------
const health = [];
for (const [network, urls] of Object.entries(PROVIDERS)) {
  for (const url of urls) {
    // Public endpoints drop requests now and then; a health fixture should show a health answer.
    let r = await rpc(url, 'getHealth');
    for (let i = 0; i < 3 && r.httpStatus !== 200; i += 1) r = await rpc(url, 'getHealth');
    health.push({ network, ...r });
    console.log(`health ${network} ${url} -> ${r.httpStatus ?? r.networkError}`);
  }
}
writeFileSync(resolve(outDir, 'rpc-health.json'), JSON.stringify({ provenance: meta, samples: health }, null, 2) + '\n');

// ---- real error responses ----------------------------------------------------
const oldest = JSON.parse(health.find((h) => h.url === SDF_TESTNET).bodyText).result.oldestLedger;
const errors = [];
const cases = [
  [SDF_TESTNET, 'getLedgers', { startLedger: oldest - 100000, pagination: { limit: 1 } }, 'out-of-retention getLedgers'],
  [SDF_TESTNET, 'getTransactions', { startLedger: oldest - 100000, pagination: { limit: 1 } }, 'out-of-retention getTransactions'],
  [SDF_TESTNET, 'getEvents', { startLedger: oldest - 100000, filters: [], pagination: { limit: 1 } }, 'out-of-retention getEvents'],
  [SDF_TESTNET, 'nope', undefined, 'unknown method'],
  [`${SDF_TESTNET}/nope`, 'getHealth', undefined, 'bad path (HTTP 404)'],
  ['https://rpc.ankr.com/stellar_testnet', 'getHealth', undefined, 'provider requiring an API key (HTTP 403)'],
];
// A real mainnet refusal: creit.tech keeps ~1 day, so a 30-day-old getLedgers is out of range.
const CREIT = 'https://soroban-rpc.creit.tech';
const creitLatest = JSON.parse(health.find((h) => h.url === CREIT).bodyText).result.latestLedger;
cases.push([
  CREIT,
  'getLedgers',
  { startLedger: creitLatest - 30 * 17280, pagination: { limit: 1 } },
  'mainnet out-of-retention getLedgers (creit.tech)',
]);
for (const [url, method, params, label] of cases) {
  const r = await rpc(url, method, params);
  errors.push({ label, ...r });
  console.log(`error "${label}" -> ${r.httpStatus ?? r.networkError}`);
}
writeFileSync(resolve(outDir, 'rpc-errors.json'), JSON.stringify({ provenance: meta, samples: errors }, null, 2) + '\n');
console.log(`wrote fixtures to ${outDir}`);
