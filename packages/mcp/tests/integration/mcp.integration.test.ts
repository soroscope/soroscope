import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Keypair } from '@stellar/stellar-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contractInstanceKey } from '@soroscope/core';

// A real MCP client talking to the real built server over stdio, which talks to the real testnet.
const BIN = resolve(__dirname, '../../dist/bin.js');
const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../test-utils/fixtures/fixture-contract.json'), 'utf8'),
) as { contractId: string };
const XDR = JSON.parse(
  readFileSync(resolve(__dirname, '../../../core/tests/fixtures/soroban-xdr.json'), 'utf8'),
) as { items: { type: string; b64: string; oracle: unknown }[]; provenance: { nativeAssetContract: string } };

interface ToolReply {
  isError?: boolean;
  structuredContent?: Record<string, any>;
  content: { type: string; text: string }[];
}

async function connect(env: Record<string, string> = {}, cwd?: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BIN],
    env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '', ...env },
    ...(cwd === undefined ? {} : { cwd }),
    stderr: 'ignore',
  });
  const client = new Client({ name: 'soroscope-test', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

const call = async (client: Client, name: string, args: Record<string, unknown>): Promise<ToolReply> =>
  (await client.callTool({ name, arguments: args })) as unknown as ToolReply;

let client: Client;
beforeAll(async () => {
  client = await connect();
}, 60_000);
afterAll(async () => {
  await client.close();
});

describe('the tool list', () => {
  it('exposes the documented tools, every one marked read-only', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'check_baseline',
      'decode_xdr',
      'explain_error',
      'get_contract_spec',
      'get_events',
      'get_ledger_entries',
      'get_transaction',
      'rpc_route_explain',
      'rpc_status',
      'simulate_invocation',
      'simulate_transaction',
    ]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.annotations?.destructiveHint, t.name).toBe(false);
    }
  });

  it('exposes no tool that could sign, send or fund', async () => {
    const { tools } = await client.listTools();
    for (const t of tools) expect(t.name).not.toMatch(/send|sign|submit|fund|keypair|friendbot|deploy/i);
  });
});

describe('decode_xdr (real XDR, expected values from the stellar CLI)', () => {
  it('decodes a real ScVal and offers a plain form', async () => {
    const item = XDR.items.find((i) => i.type === 'ScVal' && JSON.stringify(i.oracle).startsWith('{"string"'))!;
    const r = await call(client, 'decode_xdr', { type: 'ScVal', xdr: item.b64 });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent!['plain']).toBe((item.oracle as { string: string }).string);
  });

  it('turns bad XDR into a tool error, not a crash', async () => {
    const r = await call(client, 'decode_xdr', { type: 'ScVal', xdr: 'AAAA' });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/decode/i);
  });

  it('rejects input that is not base64', async () => {
    const r = await call(client, 'decode_xdr', { type: 'ScVal', xdr: 'not base64 !!!' });
    expect(r.isError).toBe(true);
  });
});

describe('RPC tools (live testnet)', () => {
  it('rpc_status reports each provider', async () => {
    const r = await call(client, 'rpc_status', { network: 'testnet', samples: 2 });
    expect(r.isError).toBeFalsy();
    const providers = r.structuredContent!['providers'] as { provider: string; status: string }[];
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((p) => p.status === 'healthy')).toBe(true);
  });

  it('rpc_route_explain says why no provider can serve an ancient ledger', async () => {
    const r = await call(client, 'rpc_route_explain', { network: 'testnet', method: 'getEvents', startLedger: 1000 });
    expect(r.structuredContent!['chosen']).toBeUndefined();
    const excluded = r.structuredContent!['excluded'] as { reason: string }[];
    expect(excluded.some((e) => /older than its oldest servable ledger/.test(e.reason))).toBe(true);
  });
});

describe('contract tools (live testnet, deployed fixture contract)', () => {
  it('get_contract_spec lists functions and error names', async () => {
    const r = await call(client, 'get_contract_spec', { network: 'testnet', contractId: FIXTURE.contractId });
    const fns = (r.structuredContent!['functions'] as { name: string }[]).map((f) => f.name);
    expect(fns).toEqual(expect.arrayContaining(['work', 'move_funds', 'fail_with']));
    const errs = (r.structuredContent!['errors'] as { name: string }[]).map((e) => e.name);
    expect(errs).toEqual(expect.arrayContaining(['NotFound', 'InsufficientFunds']));
  });

  it('simulate_invocation succeeds and reports resources', async () => {
    const r = await call(client, 'simulate_invocation', { network: 'testnet', contractId: FIXTURE.contractId, function: 'work', args: { n: 10 } });
    expect(r.structuredContent!['ok']).toBe(true);
    expect(Number(r.structuredContent!['resources'].instructions)).toBeGreaterThan(0);
  });

  it('simulate_invocation names a contract error from the spec', async () => {
    const r = await call(client, 'simulate_invocation', { network: 'testnet', contractId: FIXTURE.contractId, function: 'fail_with', args: { code: 2 } });
    expect(r.structuredContent!['ok']).toBe(false);
    expect(r.structuredContent!['failure'].errorName).toBe('InsufficientFunds');
    expect(r.structuredContent!['summary']).toContain('Error::InsufficientFunds');
  });

  it('explain_error names a code from the contract spec', async () => {
    const r = await call(client, 'explain_error', { network: 'testnet', contractId: FIXTURE.contractId, errorCode: 3 });
    expect(r.structuredContent!['explanation']).toContain('Error::Unauthorized');
  });

  it('get_ledger_entries reads and decodes the contract instance', async () => {
    const r = await call(client, 'get_ledger_entries', { network: 'testnet', keys: [contractInstanceKey(FIXTURE.contractId)] });
    const entry = (r.structuredContent!['entries'] as { entry: { type: string } }[])[0]!;
    expect(entry.entry.type).toBe('contractData');
  });

  it('get_events decodes real recent events from the native asset contract', async () => {
    const health = (await (await fetch('https://soroban-testnet.stellar.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }) })).json()) as { result: { latestLedger: number } };
    const r = await call(client, 'get_events', { network: 'testnet', startLedger: health.result.latestLedger - 300, limit: 5 });
    expect(r.isError).toBeFalsy();
    const events = r.structuredContent!['events'] as { topics: unknown[] }[];
    expect(Array.isArray(events)).toBe(true);
    if (events.length > 0) expect(Array.isArray(events[0]!.topics)).toBe(true);
  });

  it('get_transaction explains a real recent transaction', async () => {
    const res = (await (await fetch('https://soroban-testnet.stellar.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }) })).json()) as { result: { latestLedger: number } };
    const list = (await (await fetch('https://soroban-testnet.stellar.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransactions', params: { startLedger: res.result.latestLedger - 100, pagination: { limit: 5 } } }) })).json()) as { result: { transactions: { txHash: string }[] } };
    const hash = list.result.transactions[0]!.txHash;
    const r = await call(client, 'get_transaction', { network: 'testnet', hash });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent!['status']).toMatch(/SUCCESS|FAILED/);
    expect(typeof r.structuredContent!['explanation']).toBe('string');
  });
});

describe('safety', () => {
  it('refuses any input that contains a secret key, and says what to do', async () => {
    const seed = Keypair.random().secret();
    for (const [name, args] of [
      ['simulate_invocation', { network: 'testnet', contractId: FIXTURE.contractId, function: 'work', args: { n: seed } }],
      ['decode_xdr', { type: 'ScVal', xdr: 'AAAA', note: seed }],
    ] as const) {
      const r = await call(client, name, args);
      expect(r.isError, name).toBe(true);
    }
    const r = await call(client, 'simulate_invocation', { network: 'testnet', contractId: FIXTURE.contractId, function: 'work', args: { n: seed } });
    expect(r.content[0]!.text).toMatch(/secret key/i);
    expect(r.content[0]!.text).not.toContain(seed);
  });

  it('ignores custom RPC URLs unless the operator enabled them', async () => {
    const r = await call(client, 'get_contract_spec', { network: 'testnet', contractId: FIXTURE.contractId, rpcUrls: ['https://soroban-testnet.stellar.org'] });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Custom RPC URLs are disabled/);
  });

  it('when enabled, still refuses private and local addresses', async () => {
    const open = await connect({ SOROSCOPE_MCP_ALLOW_CUSTOM_RPC: '1' });
    try {
      for (const url of ['https://127.0.0.1/rpc', 'https://169.254.169.254/x', 'https://localhost/rpc']) {
        const r = await call(open, 'get_contract_spec', { network: 'testnet', contractId: FIXTURE.contractId, rpcUrls: [url] });
        expect(r.isError, url).toBe(true);
      }
    } finally {
      await open.close();
    }
  });

  it('rejects malformed identifiers before doing anything', async () => {
    expect((await call(client, 'get_contract_spec', { network: 'testnet', contractId: 'nope' })).isError).toBe(true);
    expect((await call(client, 'get_transaction', { network: 'testnet', hash: 'abc' })).isError).toBe(true);
  });
});

describe('check_baseline', () => {
  let dir: string;
  let scoped: Client;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'soroscope-mcp-'));
    writeFileSync(
      join(dir, 'soroscope.config.json'),
      JSON.stringify({ version: 1, invocations: [{ name: 'work', contractId: FIXTURE.contractId, function: 'work', args: { n: 10 } }] }),
    );
    writeFileSync(
      join(dir, 'deploys.json'),
      JSON.stringify({ version: 1, contracts: { c: { wasm: 'x.wasm' } }, invocations: [{ name: 'a', contract: 'c', function: 'f' }] }),
    );
    scoped = await connect({}, dir);
  }, 60_000);
  afterAll(async () => {
    await scoped.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs a config in the workspace', async () => {
    const r = await call(scoped, 'check_baseline', {});
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent!['result']).toBe('warn'); // no baseline yet: the call is "new"
    expect(r.structuredContent!['markdown']).toContain('<!-- soroscope-ci -->');
  });

  it('refuses paths that escape the workspace', async () => {
    const r = await call(scoped, 'check_baseline', { configPath: '../../etc/passwd' });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/inside the workspace/);
  });

  it('refuses configs that would deploy contracts', async () => {
    const r = await call(scoped, 'check_baseline', { configPath: 'deploys.json' });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/never writes|writes to the test network/);
  });
});
