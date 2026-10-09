#!/usr/bin/env node
// Records REAL Soroban XDR from the live Stellar testnet and decodes every blob
// with the `stellar` CLI so decoders can be checked against an independent
// implementation.
//
// Needs: the `stellar` CLI on PATH. Uses no signing keys: transactions are built
// unsigned (`--build-only`) from a public address and only ever simulated.
//
// Output: packages/core/tests/fixtures/soroban-xdr.json
//   { provenance, simulations: [...], items: [{ type, b64, source, oracle }] }
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../core/tests/fixtures');
mkdirSync(outDir, { recursive: true });

const RPC = 'https://soroban-testnet.stellar.org';
const NETWORK = 'testnet';
// Public SDF testnet accounts; only used as transaction sources / argument values.
const SRC = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
const OTHER = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';

const stellar = (args, input) =>
  execFileSync('stellar', args, { encoding: 'utf8', input, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();

async function rpc(method, params, attempts = 5) {
  for (let i = 1; ; i += 1) {
    try {
      return await rpcOnce(method, params);
    } catch (err) {
      // A JSON-RPC error is a real answer and final; a dropped connection is worth another try.
      if (i >= attempts || String(err.message).startsWith(`${method}: `)) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function rpcOnce(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

const SAC = stellar(['contract', 'id', 'asset', '--asset', 'native', '--network', NETWORK]);
console.log('native SAC on testnet:', SAC);

const items = [];
const seen = new Set();
function addItem(type, b64, source) {
  if (typeof b64 !== 'string' || b64 === '') return;
  const key = `${type}:${b64}`;
  if (seen.has(key)) return;
  seen.add(key);
  let oracle = null;
  let oracleError = null;
  try {
    oracle = JSON.parse(stellar(['xdr', 'decode', '--type', type, '--input', 'single-base64', '--output', 'json', b64]));
  } catch (err) {
    oracleError = String(err.stderr || err.message).slice(0, 300);
  }
  items.push({ type, b64, source, oracle, oracleError });
}

// ---- simulations of calls against the native-asset contract -----------------
const cases = [
  { name: 'balance of a funded account', fn: 'balance', args: ['--id', SRC] },
  { name: 'name', fn: 'name', args: [] },
  { name: 'symbol', fn: 'symbol', args: [] },
  { name: 'decimals', fn: 'decimals', args: [] },
  { name: 'transfer needing auth from a non-source address', fn: 'transfer', args: ['--from', OTHER, '--to', SRC, '--amount', '1'] },
  { name: 'transfer exceeding the balance (contract error)', fn: 'transfer', args: ['--from', OTHER, '--to', SRC, '--amount', '99999999999999'] },
  { name: 'allowance (two addresses)', fn: 'allowance', args: ['--from', SRC, '--spender', OTHER] },
];

const simulations = [];
for (const c of cases) {
  let tx;
  try {
    tx = stellar(['contract', 'invoke', '--id', SAC, '--network', NETWORK, '--source-account', SRC, '--build-only', '--', c.fn, ...c.args]);
  } catch (err) {
    console.log(`skip "${c.name}": cannot build (${String(err.stderr || err.message).slice(0, 120)})`);
    continue;
  }
  const request = { transaction: tx };
  let response;
  try {
    response = await rpc('simulateTransaction', request);
  } catch (err) {
    console.log(`skip "${c.name}": ${err.message.slice(0, 160)}`);
    continue;
  }
  simulations.push({ name: c.name, function: c.fn, request, response });
  console.log(`simulated "${c.name}" -> ${response.error ? 'error' : 'ok'}`);

  addItem('TransactionEnvelope', tx, `request:${c.name}`);
  addItem('SorobanTransactionData', response.transactionData, `simulate:${c.name}`);
  for (const ev of response.events ?? []) addItem('DiagnosticEvent', ev, `simulate:${c.name}`);
  for (const r of response.results ?? []) {
    addItem('ScVal', r.xdr, `simulate:${c.name}:return`);
    for (const a of r.auth ?? []) addItem('SorobanAuthorizationEntry', a, `simulate:${c.name}`);
  }
  if (response.restorePreamble) addItem('SorobanTransactionData', response.restorePreamble.transactionData, `simulate:${c.name}:restore`);
}

// ---- ledger entries: the contract instance of the native asset contract ------
const instanceKey = stellar(
  ['xdr', 'encode', '--type', 'LedgerKey', '--input', 'json', '--output', 'single-base64'],
  JSON.stringify({ contract_data: { contract: SAC, key: 'ledger_key_contract_instance', durability: 'persistent' } }),
);
addItem('LedgerKey', instanceKey, 'ledger-key:native asset contract instance');
const entries = await rpc('getLedgerEntries', { keys: [instanceKey] });
for (const e of entries.entries ?? []) {
  addItem('LedgerKey', e.key, 'getLedgerEntries:key');
  addItem('LedgerEntryData', e.xdr, 'getLedgerEntries:xdr');
}

// ---- recent events and transactions ------------------------------------------
const health = await rpc('getHealth');
const events = await rpc('getEvents', {
  startLedger: health.latestLedger - 500,
  filters: [{ type: 'contract' }],
  pagination: { limit: 30 },
});
for (const ev of events.events ?? []) {
  for (const t of ev.topic ?? []) addItem('ScVal', t, `getEvents:${ev.type}:topic`);
  addItem('ScVal', ev.value, `getEvents:${ev.type}:value`);
}
console.log(`events: ${events.events?.length ?? 0}`);

const txs = await rpc('getTransactions', { startLedger: health.latestLedger - 200, pagination: { limit: 25 } });
let soroban = 0;
for (const t of txs.transactions ?? []) {
  addItem('TransactionEnvelope', t.envelopeXdr, 'getTransactions:envelope');
  addItem('TransactionResult', t.resultXdr, 'getTransactions:result');
  for (const d of t.diagnosticEventsXdr ?? []) addItem('DiagnosticEvent', d, 'getTransactions:diagnosticEvents');
  if ((t.diagnosticEventsXdr ?? []).length > 0) soroban += 1;
}
console.log(`transactions: ${txs.transactions?.length ?? 0} (${soroban} with diagnostic events)`);

// ---- real contracts: WASM + spec, with the CLI's reading of the spec as the oracle ----
const contractIds = new Set();
for (const ev of events.events ?? []) if (ev.contractId) contractIds.add(ev.contractId);
const contracts = [];
for (const id of contractIds) {
  if (contracts.length >= 3 || id === SAC) continue;
  try {
    const ikey = stellar(
      ['xdr', 'encode', '--type', 'LedgerKey', '--input', 'json', '--output', 'single-base64'],
      JSON.stringify({ contract_data: { contract: id, key: 'ledger_key_contract_instance', durability: 'persistent' } }),
    );
    const inst = await rpc('getLedgerEntries', { keys: [ikey] });
    const instXdr = inst.entries?.[0]?.xdr;
    if (!instXdr) continue;
    const decoded = JSON.parse(stellar(['xdr', 'decode', '--type', 'LedgerEntryData', '--input', 'single-base64', '--output', 'json', instXdr]));
    const exe = decoded.contract_data?.val?.contract_instance?.executable;
    const wasmHash = typeof exe === 'object' ? exe.wasm : null;
    if (!wasmHash) continue;
    const ckey = stellar(
      ['xdr', 'encode', '--type', 'LedgerKey', '--input', 'json', '--output', 'single-base64'],
      JSON.stringify({ contract_code: { hash: wasmHash } }),
    );
    const code = await rpc('getLedgerEntries', { keys: [ckey] });
    const codeXdr = code.entries?.[0]?.xdr;
    if (!codeXdr) continue;
    const codeEntry = JSON.parse(stellar(['xdr', 'decode', '--type', 'LedgerEntryData', '--input', 'single-base64', '--output', 'json', codeXdr]));
    const wasmHex = codeEntry.contract_code?.code;
    if (!wasmHex || wasmHex.length > 400000) continue;
    const dir = mkdtempSync(resolve(tmpdir(), 'soroscope-wasm-'));
    const file = resolve(dir, 'c.wasm');
    writeFileSync(file, Buffer.from(wasmHex, 'hex'));
    let spec = null;
    let meta = null;
    try {
      spec = JSON.parse(stellar(['contract', 'info', 'interface', '--wasm', file, '--output', 'json']));
      meta = JSON.parse(stellar(['contract', 'info', 'meta', '--wasm', file, '--output', 'json']));
    } catch (err) {
      console.log(`  oracle could not read spec for ${id}: ${String(err.stderr || err.message).slice(0, 120)}`);
    }
    rmSync(dir, { recursive: true, force: true });
    contracts.push({
      contractId: id,
      wasmHash,
      instanceKey: ikey,
      instanceEntryXdr: instXdr,
      codeKey: ckey,
      codeEntryXdr: codeXdr,
      wasmBase64: Buffer.from(wasmHex, 'hex').toString('base64'),
      oracleSpec: spec,
      oracleMeta: meta,
    });
    console.log(`contract ${id}: wasm ${wasmHex.length / 2} bytes, spec entries: ${Array.isArray(spec) ? spec.length : 'n/a'}`);
  } catch (err) {
    console.log(`skip contract ${id}: ${String(err.message).slice(0, 120)}`);
  }
}
if (contracts.length > 0) {
  for (const c of contracts) {
    addItem('LedgerEntryData', c.instanceEntryXdr, `contract:${c.contractId}:instance`);
  }
}

const byType = {};
for (const i of items) byType[i.type] = (byType[i.type] ?? 0) + 1;
const failed = items.filter((i) => i.oracle === null);
console.log('items by type:', byType);
console.log(`oracle could not decode ${failed.length} of ${items.length}`);
for (const f of failed.slice(0, 5)) console.log(`  ${f.type} (${f.source}): ${f.oracleError}`);

writeFileSync(
  resolve(outDir, 'soroban-xdr.json'),
  JSON.stringify(
    {
      provenance: {
        tool: 'packages/test-utils/scripts/record-soroban.mjs',
        recordedAt: new Date().toISOString(),
        rpc: RPC,
        network: NETWORK,
        latestLedger: health.latestLedger,
        stellarCli: stellar(['--version']).split('\n')[0],
        nativeAssetContract: SAC,
      },
      simulations,
      contracts,
      items,
    },
    null,
    2,
  ) + '\n',
);
console.log('wrote soroban-xdr.json');
