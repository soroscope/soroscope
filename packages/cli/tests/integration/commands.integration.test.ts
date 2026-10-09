import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const BIN = resolve(__dirname, '../../dist/bin.js');
const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../test-utils/fixtures/fixture-contract.json'), 'utf8'),
) as { contractId: string };
const WASM = resolve(
  __dirname,
  '../../../test-utils/fixture-contract/target/wasm32v1-none/release/soroscope_fixture_contract.wasm',
);
const XDR = JSON.parse(
  readFileSync(resolve(__dirname, '../../../core/tests/fixtures/soroban-xdr.json'), 'utf8'),
) as { items: { type: string; b64: string; oracle: unknown }[] };

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

async function soroscope(...args: string[]): Promise<Result> {
  try {
    const { stdout, stderr } = await run(process.execPath, [BIN, ...args], { timeout: 200_000 });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: typeof e.code === 'number' ? e.code : 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('soroscope decode (real XDR captured from testnet)', () => {
  it('decodes a real ScVal to the same value the stellar CLI reports', async () => {
    const item = XDR.items.find((i) => i.type === 'ScVal' && JSON.stringify(i.oracle).startsWith('{"u32"'))!;
    const r = await soroscope('decode', 'ScVal', item.b64);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout) as { type: string; value: number };
    expect(out.type).toBe('u32');
    expect(out.value).toBe((item.oracle as { u32: number }).u32);
  });

  it('--plain prints ordinary JSON', async () => {
    const item = XDR.items.find((i) => i.type === 'ScVal' && JSON.stringify(i.oracle).startsWith('{"string"'))!;
    const r = await soroscope('decode', 'ScVal', item.b64, '--plain');
    expect(JSON.parse(r.stdout)).toBe((item.oracle as { string: string }).string);
  });

  it('decodes a real diagnostic event, with contract ids as C... strings', async () => {
    const item = XDR.items.find((i) => i.type === 'DiagnosticEvent' && (i.oracle as { event: { contract_id: string | null } }).event.contract_id !== null)!;
    const r = await soroscope('decode', 'DiagnosticEvent', item.b64);
    expect(r.code).toBe(0);
    expect((JSON.parse(r.stdout) as { event: { contractId: string } }).event.contractId).toBe(
      (item.oracle as { event: { contract_id: string } }).event.contract_id,
    );
  });

  it('exits 1 with a reason on bad XDR and 2 on an unknown type', async () => {
    const bad = await soroscope('decode', 'ScVal', 'AAAA');
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('Cannot decode as ScVal');
    expect((await soroscope('decode', 'Nonsense', 'AAAA')).code).toBe(2);
  });

  it('explains a real failed transaction result', async () => {
    const item = XDR.items.find((i) => i.type === 'TransactionResult' && 'tx_failed' in (i.oracle as { result: object }).result)!;
    const r = await soroscope('explain', item.b64);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^txFAILED/);
  });
});

describe('soroscope spec', () => {
  it('reads a local WASM file', async () => {
    const r = await soroscope('spec', WASM);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('work(n: U32) -> U64');
    expect(r.stdout).toContain('#2  Error::InsufficientFunds');
  });

  it('reads a deployed contract from the ledger', async () => {
    const r = await soroscope('spec', FIXTURE.contractId, '--network', 'testnet');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('move_funds(');
  });

  it('exits 2 for something that is neither a contract id nor a file', async () => {
    expect((await soroscope('spec', 'nonsense')).code).toBe(2);
  });
});

describe('soroscope simulate', () => {
  it('succeeds and prints the return value', async () => {
    const r = await soroscope('simulate', '--contract', FIXTURE.contractId, '--fn', 'work', '--args', '{"n":10}');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Simulation succeeded');
    expect(r.stdout).toMatch(/return: u64\(/);
  });

  it('names a contract error from the spec and exits 1', async () => {
    const r = await soroscope('simulate', '--contract', FIXTURE.contractId, '--fn', 'fail_with', '--args', '{"code":2}');
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('Error::InsufficientFunds');
  });

  it('exits 2 for an unknown function', async () => {
    const r = await soroscope('simulate', '--contract', FIXTURE.contractId, '--fn', 'nope', '--args', '{}');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('no function named');
  });
});

describe('soroscope check', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'soroscope-cli-check-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const config = (n: number): string => {
    const path = join(dir, 'soroscope.config.json');
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        invocations: [{ name: 'work', contractId: FIXTURE.contractId, function: 'work', args: { n } }],
      }),
    );
    return path;
  };

  it('records a baseline, passes, then fails with exit 1 when the work grows', async () => {
    const recorded = await soroscope('check', '--config', config(10), '--update-baseline');
    expect(recorded.code).toBe(0);
    expect((await soroscope('check', '--config', config(10))).code).toBe(0);

    const regressed = await soroscope('check', '--config', config(5000), '--format', 'markdown');
    expect(regressed.code).toBe(1);
    expect(regressed.stdout).toContain('<!-- soroscope-ci -->');
    expect(regressed.stdout).toContain('FAIL');
  });

  it('exits 2 and lists every problem in a bad config', async () => {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ version: 1, invocations: [{ name: 'a', function: 'f' }] }));
    const r = await soroscope('check', '--config', bad);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('exactly one');
  });
});
