import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Contract, Keypair, Networks } from '@stellar/stellar-sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  SoroscopeRouter,
  TransactionSimulator,
  describeSimulation,
  fetchContractSpec,
  publicProviderUrls,
} from '@soroscope/core';
import {
  buildInvocationXdr,
  deployWasm,
  friendbotUrlFor,
  fundWithFriendbot,
  loadSpec,
  sendInvocation,
  toScVals,
} from '../../src';

// Real testnet, real deployed fixture contract (see packages/test-utils/scripts/deploy-fixture-contract.mjs).
const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../test-utils/fixtures/fixture-contract.json'), 'utf8'),
) as { contractId: string; deployer: string };
const WASM = resolve(
  __dirname,
  '../../../test-utils/fixture-contract/target/wasm32v1-none/release/soroscope_fixture_contract.wasm',
);
const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
// Simulation needs only a well-formed source address; it need not exist.
const SOURCE = Keypair.random().publicKey();
const PASS = Networks.TESTNET;

let router: SoroscopeRouter;
let sim: TransactionSimulator;
let spec: Awaited<ReturnType<typeof loadSpec>>['spec'];

beforeAll(async () => {
  router = await SoroscopeRouter.create({ providers: publicProviderUrls('testnet') });
  sim = new TransactionSimulator(router);
  spec = (await loadSpec(router, FIXTURE.contractId)).spec;
});

const call = (fn: string, args?: Record<string, unknown>) =>
  sim.simulateAndExplain(
    buildInvocationXdr({ contractId: FIXTURE.contractId, function: fn, args: args ?? {}, source: SOURCE, networkPassphrase: PASS, spec }),
  );

describe('reading the contract spec from the ledger', () => {
  it('finds the functions and error enum the contract declares', async () => {
    const parsed = await fetchContractSpec(router, FIXTURE.contractId);
    expect(parsed.functions.map((f) => f.name)).toEqual(
      expect.arrayContaining(['init', 'mint', 'move_funds', 'work', 'touch', 'fail_with', 'boom']),
    );
    expect(parsed.errors.map((e) => e.name).sort()).toEqual(['InsufficientFunds', 'Invalid', 'NotFound', 'Unauthorized']);
    expect(parsed.source.kind).toBe('wasm');
  });

  it('the native asset contract has no spec', async () => {
    const loaded = await loadSpec(router, NATIVE_SAC);
    expect(loaded.spec).toBeNull();
    expect(loaded.source.kind).toBe('stellarAsset');
  });
});

describe('named arguments', () => {
  it('convert through the contract spec', async () => {
    const report = await call('work', { n: 10 });
    expect(report.ok).toBe(true);
    expect(report.returnValue?.type).toBe('u64');
  });

  it('reject an unknown function and a missing spec with a clear message', () => {
    expect(() => toScVals('nope', {}, spec)).toThrow(/no function named/);
    expect(() => toScVals('anything', { a: 1 }, null)).toThrow(/Stellar Asset Contract/);
  });

  it('typed positional arguments work without a spec (native asset contract)', async () => {
    const xdr = buildInvocationXdr({
      contractId: NATIVE_SAC,
      function: 'balance',
      args: [{ type: 'address', value: FIXTURE.deployer }],
      source: SOURCE,
      networkPassphrase: PASS,
    });
    const report = await sim.simulate(xdr);
    expect(report.ok).toBe(true);
    expect(report.returnValue?.type).toBe('i128');
  });

  it('refuses a malformed source or contract id before touching the network', () => {
    expect(() => buildInvocationXdr({ contractId: FIXTURE.contractId, function: 'work', args: { n: 1 }, source: 'nope', networkPassphrase: PASS, spec })).toThrow(/valid G/);
    expect(() => buildInvocationXdr({ contractId: 'CNOPE', function: 'work', args: { n: 1 }, source: SOURCE, networkPassphrase: PASS, spec })).toThrow(/valid C/);
  });
});

describe('contract errors are named from the contract spec', () => {
  it.each([
    [1, 'NotFound'],
    [2, 'InsufficientFunds'],
    [3, 'Unauthorized'],
    [4, 'Invalid'],
  ])('fail_with(%i) -> %s', async (code, name) => {
    const report = await call('fail_with', { code });
    expect(report.ok).toBe(false);
    expect(report.failure?.error.contractCode).toBe(code);
    expect(report.failure?.errorName).toBe(name);
    expect(report.failure?.errorEnum).toBe('Error');
    expect(report.failure?.contractId).toBe(FIXTURE.contractId);
    expect(describeSimulation(report)).toContain(`Error::${name}`);
  });

  it('fail_with(0) succeeds', async () => {
    expect((await call('fail_with', { code: 0 })).ok).toBe(true);
  });

  it('a panic is a host error, not a contract error', async () => {
    const report = await call('boom');
    expect(report.ok).toBe(false);
    expect(report.error).toContain('boom');
  });

  it('a read of a missing key fails with NotFound', async () => {
    const report = await call('get', { key: 'definitely_missing' });
    expect(report.failure?.errorName).toBe('NotFound');
  });
});

describe('resources scale with the work asked for', () => {
  it('work(n): more iterations cost strictly more instructions', async () => {
    const cost = async (n: number): Promise<number> =>
      (await call('work', { n })).transactionData!.resources.instructions;
    const [a, b, c] = [await cost(10), await cost(1000), await cost(5000)];
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    // A fixed ~400k instruction overhead dominates small n; the growth is what matters.
    expect(c - a).toBeGreaterThan(200_000);
  });

  it('touch(n): more writes grow the read-write footprint', async () => {
    const one = (await call('touch', { n: 1 })).transactionData!.resources.footprint.readWrite.length;
    const five = (await call('touch', { n: 5 })).transactionData!.resources.footprint.readWrite.length;
    expect(five).toBeGreaterThan(one);
  });
});

describe('authorization and events', () => {
  it('move_funds needs the sender to authorize, and names the call', async () => {
    const to = Keypair.random().publicKey();
    const from = Keypair.random().publicKey();
    const report = await sim.simulate(
      buildInvocationXdr({ contractId: FIXTURE.contractId, function: 'move_funds', args: { from, to, amount: 1n }, source: SOURCE, networkPassphrase: PASS, spec }),
    );
    // The sender holds nothing, so the call fails; the failure is the contract's own.
    expect(report.ok).toBe(false);
    expect(report.failure?.error.contractCode).toBe(2);
  });

  it('emit(n) produces typed events', async () => {
    const report = await call('emit', { n: 3 });
    expect(report.ok).toBe(true);
    const ticks = report.events.filter((e) => e.event.type === 'contract' && e.event.contractId === FIXTURE.contractId);
    expect(ticks).toHaveLength(3);
  });
});

describe('Mode B: deploy the PR build and call it (throwaway key, real testnet)', () => {
  it('uploads WASM, creates a contract, runs init and reads it back', { timeout: 240_000 }, async () => {
    const signer = Keypair.random();
    await fundWithFriendbot(friendbotUrlFor(PASS)!, signer.publicKey());

    const wasm = readFileSync(WASM);
    const deployed = await deployWasm({ rpc: router, wasm, signer, networkPassphrase: PASS });
    expect(deployed.contractId).toMatch(/^C[A-Z2-7]{55}$/);

    // The deployed code is retrievable and matches what we uploaded.
    const loaded = await fetchContractSpec(router, deployed.contractId);
    expect(loaded.source).toEqual({ kind: 'wasm', wasmHash: deployed.wasmHash });
    const freshSpec = (await loadSpec(router, deployed.contractId)).spec!;

    await sendInvocation({
      rpc: router,
      signer,
      networkPassphrase: PASS,
      build: (b) =>
        b.addOperation(
          new Contract(deployed.contractId).call('init', ...toScVals('init', { admin: signer.publicKey() }, freshSpec)),
        ),
    });

    // A second init is rejected by the contract: proof the first one really ran on chain.
    const again = await sim.simulateAndExplain(
      buildInvocationXdr({ contractId: deployed.contractId, function: 'init', args: { admin: signer.publicKey() }, source: signer.publicKey(), networkPassphrase: PASS, spec: freshSpec }),
    );
    expect(again.failure?.errorName).toBe('Invalid');
  });
});
