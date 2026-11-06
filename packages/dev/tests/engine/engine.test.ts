import { createHash } from 'node:crypto';
import { scValToJs } from '@soroscope/core';
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalNetwork } from '../../src';
import { fixture, recordedAt, v1Wasm, v2Wasm } from './helpers';

const b64 = (v: xdr.ScVal): string => v.toXDR('base64');
const i128 = (n: bigint): string => b64(nativeToScVal(n, { type: 'i128' }));
const sym = (s: string): string => b64(xdr.ScVal.scvSymbol(s));
const addr = (a: string): string => b64(new Address(a).toScVal());
// A valid account address that exists nowhere: the recipient in transfers.
const OTHER = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';

describe('LocalNetwork (fixture contract, in-process)', () => {
  let net: LocalNetwork;
  let id: string;
  let me: string;

  // scValToJs renders 128-bit integers as decimal strings.
  const value = (fn: string, args: string[] = []): unknown => {
    const { report } = net.invoke(id, fn, args, { commit: false });
    expect(report.ok, report.error ?? '').toBe(true);
    return report.returnValue === null ? null : scValToJs(report.returnValue);
  };

  beforeEach(() => {
    net = LocalNetwork.create(fixture, { timestamp: recordedAt });
    ({ contractId: id } = net.deploy(v1Wasm));
    me = addr(net.sourceAccount);
  });

  it('deploys to a contract address and reports the WASM hash', () => {
    const second = net.deploy(v1Wasm);
    expect(id).toMatch(/^C[A-Z2-7]{55}$/);
    expect(second.contractId).not.toBe(id);
    expect(second.wasmHash).toBe(createHash('sha256').update(v1Wasm).digest('hex'));
  });

  it('applies a successful call and reads it back', () => {
    expect(net.invoke(id, 'init', [me]).committed).toBe(true);
    const mint = net.invoke(id, 'mint', [me, i128(1000n)]);
    expect(mint.report.ok).toBe(true);
    expect(mint.report.auth).toHaveLength(1);
    expect(mint.report.stateChanges.map((c) => c.type)).toContain('created');
    expect(value('balance', [me])).toBe('1000');
  });

  it('reports a contract error with its code and applies nothing', () => {
    net.invoke(id, 'init', [me]);
    net.invoke(id, 'mint', [me, i128(100n)]);
    const r = net.invoke(id, 'move_funds', [me, addr(OTHER), i128(5000n)]);
    expect(r.report.ok).toBe(false);
    expect(r.committed).toBe(false);
    expect(r.report.failure?.error.isContractError).toBe(true);
    expect(r.report.failure?.error.contractCode).toBe(2);
    expect(value('balance', [me])).toBe('100');
  });

  it('commit: false simulates without writing', () => {
    const r = net.invoke(id, 'put', [sym('k'), i128(42n)], { commit: false });
    expect(r.report.ok).toBe(true);
    expect(r.committed).toBe(false);
    expect(
      net.invoke(id, 'get', [sym('k')], { commit: false }).report.failure?.error.contractCode,
    ).toBe(1);
  });

  it('meters work: more iterations cost more instructions', () => {
    const small = net.invoke(id, 'work', [b64(nativeToScVal(10, { type: 'u32' }))], {
      commit: false,
    });
    const big = net.invoke(id, 'work', [b64(nativeToScVal(5000, { type: 'u32' }))], {
      commit: false,
    });
    expect(big.cpuInstructions).toBeGreaterThan(small.cpuInstructions + 100_000);
    expect(big.report.minResourceFee!).toBeGreaterThan(small.report.minResourceFee!);
  });

  it('surfaces a panic as a failed call, not an exception', () => {
    const r = net.invoke(id, 'boom');
    expect(r.report.ok).toBe(false);
    expect(r.report.failure?.error.type).toBe('WasmVm');
    expect(r.report.failure?.message).toMatch(/UnreachableCodeReached/);
  });

  it('hot swaps code in place, keeping the contract ID and all its storage', () => {
    net.invoke(id, 'init', [me]);
    net.invoke(id, 'mint', [me, i128(700n)]);
    net.invoke(id, 'put', [sym('k'), i128(42n)]);
    expect(net.invoke(id, 'version', [], { commit: false }).report.ok).toBe(false);

    const swap = net.swapWasm(id, v2Wasm);
    expect(swap.contractId).toBe(id);
    expect(swap.oldWasmHash).toBe(createHash('sha256').update(v1Wasm).digest('hex'));
    expect(swap.newWasmHash).toBe(fixture.live.wasmHash);

    expect(value('version')).toBe(2);
    expect(value('balance', [me])).toBe('700'); // instance storage (admin) and persistent balance kept
    expect(value('get', [sym('k')])).toBe('42');
    // The admin recorded by init survived too: mint still finds it.
    expect(net.invoke(id, 'mint', [me, i128(1n)]).report.ok).toBe(true);
  });

  it('advances the ledger', () => {
    const before = net.sequence;
    net.advance(10);
    expect(net.sequence).toBe(before + 10);
  });

  it('rejects an unknown contract and malformed input with clear errors', () => {
    expect(() => net.swapWasm(OTHER.replace(/^G/, 'C'), v2Wasm)).toThrow(
      /invalid contract id|no contract/,
    );
    expect(() => net.invoke(id, 'put', ['not xdr'])).toThrow(/invalid argument ScVal XDR/);
    expect(() => net.deploy(Buffer.from('not wasm'))).toThrow(/upload failed/);
  });
});
