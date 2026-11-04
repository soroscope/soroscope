import { describe, expect, it } from 'vitest';
import { ContractInterface, DevSession, NoEmbeddedSpecError, signature } from '../../src';
import { fixture, recordedAt, v1Wasm, v2Wasm } from './helpers';

const OTHER = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';

describe('ContractInterface (Orbital spec parsing)', () => {
  const iface = ContractInterface.fromWasm(v1Wasm);

  it("reads the contract's functions with their parameter and return types", () => {
    const sigs = iface.functions.map(signature);
    expect(sigs).toContain('move_funds(from: address, to: address, amount: i128) -> result<void, error>');
    expect(sigs).toContain('work(n: u32) -> u64');
    expect(sigs).toContain('boom()');
  });

  it('reads the #[contractevent] declarations', () => {
    expect(iface.events.map((e) => e.name).sort()).toEqual(['Moved', 'Tick']);
  });

  it('encodes named arguments by the declared types and rejects ones that do not fit', () => {
    expect(iface.encodeArgs('put', { key: 'k', val: '42' })).toHaveLength(2);
    expect(() => iface.encodeArgs('put', { key: 'k' })).toThrow(/missing val/);
    expect(() => iface.encodeArgs('put', { key: 'k', val: 1, extra: 2 })).toThrow(/no parameter named extra/);
    expect(() => iface.encodeArgs('nope', {})).toThrow(/has no function "nope"/);
  });

  it('generates TypeScript with Orbital codegen', () => {
    const a = iface.generateTypes('fixture');
    expect(a.declarations).toMatch(/export interface MoveFundsParams \{\n\s+from: string;\n\s+to: string;\n\s+amount: string;/);
    expect(a.schemas).toContain('z.');
    expect(a.guards).toMatch(/Moved/);
  });

  it('refuses WASM with no embedded spec', () => {
    // The smallest valid WASM module: magic and version, no sections.
    expect(() => ContractInterface.fromWasm(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]))).toThrow(NoEmbeddedSpecError);
  });
});

describe('DevSession', () => {
  it('deploys the first build, hot-swaps the next, and skips identical code', () => {
    const s = DevSession.create(fixture, { timestamp: recordedAt });
    const first = s.reload(v1Wasm);
    expect(first.kind).toBe('deployed');
    expect(first.diff.added).toContain('move_funds');

    s.call('init', { admin: 'me' });
    s.call('mint', { to: 'me', amount: '1000' });
    s.call('put', { key: 'k', val: 42 });

    const second = s.reload(v2Wasm);
    expect(second.kind).toBe('swapped');
    expect(second.contractId).toBe(first.contractId);
    expect(second.diff).toEqual({ added: ['build_id', 'version'], removed: [], changed: [] });

    expect(s.call('version').value).toBe(2);
    expect(s.call('balance', { who: 'me' }).value).toBe('1000');
    expect(s.call('get', { key: 'k' }).value).toBe('42');

    expect(s.reload(v2Wasm).kind).toBe('unchanged');
  });

  it('names events from the spec and reports cost', () => {
    const s = DevSession.create(fixture, { timestamp: recordedAt });
    s.reload(v1Wasm);
    s.call('init', { admin: 'me' });
    s.call('mint', { to: 'me', amount: '500' });
    const r = s.call('move_funds', { from: 'me', to: OTHER, amount: '200' });
    expect(r.report.ok).toBe(true);
    expect(r.events).toEqual([{ name: 'Moved', fields: { from: s.network.sourceAccount, to: OTHER, amount: '200' } }]);
    expect(r.cpuInstructions).toBeGreaterThan(0);
    expect(r.report.minResourceFee).toBeGreaterThan(0n);

    const tick = s.call('emit', { n: 2 });
    expect(tick.events.map((e) => e.name)).toEqual(['Tick', 'Tick']);
    expect(tick.events[1]).toEqual({ name: 'Tick', fields: { index: 1, value: '1' } });
  });

  it('reports a failed call with the contract error and applies nothing', () => {
    const s = DevSession.create(fixture, { timestamp: recordedAt });
    s.reload(v1Wasm);
    const r = s.call('fail_with', { code: 3 });
    expect(r.report.ok).toBe(false);
    expect(r.committed).toBe(false);
    expect(r.report.failure?.error.contractCode).toBe(3);
    expect(r.summary).toMatch(/Error\(Contract, #3\)/);
    expect(r.errorCase).toEqual({ code: 3, name: 'Unauthorized', doc: 'The caller is not allowed to do that.' });
  });

  it('needs a build before calls', () => {
    const s = DevSession.create(fixture, { timestamp: recordedAt });
    expect(() => s.call('version')).toThrow(/No contract loaded/);
  });
});
