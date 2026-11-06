import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { canonicalLedgerKey, scValToJs } from '@soroscope/core';
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import { DevSession, LocalNetwork, buildContract, resolveProject } from '../../src';
import { fixture, fixture29, recordedAt, recordedAtOf, v1Wasm } from './helpers';

const FIXTURE = resolve(__dirname, '../../../test-utils/fixture-contract');
// Same shared build cache as the watch-loop test, so only the contract recompiles.
process.env.CARGO_TARGET_DIR ??= resolve(__dirname, '../../engine/target/loop-test');

const b64 = (v: xdr.ScVal): string => v.toXDR('base64');
const sym = (s: string): string => b64(xdr.ScVal.scvSymbol(s));
const i128 = (n: bigint): string => b64(nativeToScVal(n, { type: 'i128' }));

describe('the native asset contract', () => {
  // Recorded from live testnet by packages/test-utils/scripts/record-soroban.mjs.
  const liveNative = (
    JSON.parse(
      readFileSync(resolve(__dirname, '../../../core/tests/fixtures/soroban-xdr.json'), 'utf8'),
    ) as {
      provenance: { nativeAssetContract: string };
    }
  ).provenance.nativeAssetContract;

  it.each([
    ['protocol 29', fixture29],
    ['protocol 30', fixture],
  ])('is at the address the live network uses (%s)', (_name, fx) => {
    const net = LocalNetwork.create(fx, { timestamp: recordedAtOf(fx) });
    expect(net.nativeAssetContract).toBe(liveNative);
  });

  it("answers calls: name, decimals and the local account's balance", () => {
    const net = LocalNetwork.create(fixture, { timestamp: recordedAt });
    const value = (fn: string, args: string[] = []): unknown => {
      const { report } = net.invoke(net.nativeAssetContract, fn, args, { commit: false });
      expect(report.ok, report.error ?? '').toBe(true);
      return scValToJs(report.returnValue!);
    };
    expect(value('name')).toBe('native');
    expect(value('decimals')).toBe(7);
    // The synthetic local account holds 1,000,000 XLM.
    expect(value('balance', [b64(new Address(net.sourceAccount).toScVal())])).toBe(
      '10000000000000',
    );
  });

  it('is there for a contract that deploys another to use it', () => {
    // Deploying a second contract must not disturb it.
    const net = LocalNetwork.create(fixture, { timestamp: recordedAt });
    net.deploy(v1Wasm);
    expect(net.invoke(net.nativeAssetContract, 'name', [], { commit: false }).report.ok).toBe(true);
  });
});

describe('a contract extending its own TTL (real compiler)', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'soroscope-ttl-'));
  let wasm: Uint8Array;

  beforeAll(async () => {
    for (const f of ['Cargo.toml', 'Cargo.lock', 'src'])
      cpSync(resolve(FIXTURE, f), resolve(dir, f), { recursive: true });
    // The build cache is shared with the watch-loop test, which runs at the same time and
    // builds the same crate. A different package name gives this one its own output file, so
    // the two cannot overwrite each other's WASM while still sharing the compiled dependencies.
    const manifest = resolve(dir, 'Cargo.toml');
    writeFileSync(
      manifest,
      readFileSync(manifest, 'utf8').replace(
        'name = "soroscope-fixture-contract"',
        'name = "soroscope-ttl-contract"',
      ),
    );
    const lib = resolve(dir, 'src/lib.rs');
    const anchor = '    /// Read a persistent value.';
    const text = readFileSync(lib, 'utf8');
    expect(text).toContain(anchor);
    writeFileSync(
      lib,
      text.replace(
        anchor,
        `    /// Extend a persistent value's TTL (added by capabilities.test.ts).
    pub fn bump(env: Env, key: Symbol) {
        env.storage().persistent().extend_ttl(&DataKey::Item(key), 1_000_000, 1_000_000);
    }

${anchor}`,
      ),
    );
    wasm = (await buildContract(await resolveProject(dir), 'cargo')).wasm;
  }, 900_000);

  // The recorded network keeps a persistent entry for min_persistent_ttl = 120,960 ledgers.
  const AFTER_DEFAULT_TTL = 130_000;

  const session = (): { net: LocalNetwork; id: string } => {
    const s = DevSession.create(fixture, { timestamp: recordedAt });
    s.reload(wasm);
    return { net: s.network, id: s.contractId! };
  };
  // A simulation never fails on an expired persistent entry: it restores it and says so, in
  // the transaction data, exactly as Stellar RPC's does. That is how expiry is observable.
  // The contract's own instance and code expire on the same schedule and are not what is
  // being tested, so look at whether the stored value in particular needs restoring.
  const needsRestore = ({ net, id }: { net: LocalNetwork; id: string }): boolean => {
    const { report } = net.invoke(id, 'get', [sym('k')], { commit: false });
    expect(report.ok, report.error ?? '').toBe(true);
    const fp = report.transactionData!.resources.footprint;
    // `archivedEntries` index the read-write footprint only: an expired entry is restored,
    // which is a write, so the simulation moves it there.
    const rw = fp.readWrite.map((k) => canonicalLedgerKey(k));
    return report.transactionData!.archivedEntries.some(
      (i) => rw[i]!.startsWith('contractData:persistent:') && rw[i]!.includes('Item'),
    );
  };

  it('control: without extend_ttl the entry needs restoring once its default TTL passes', () => {
    const s = session();
    s.net.invoke(s.id, 'put', [sym('k'), i128(7n)]);
    expect(needsRestore(s)).toBe(false);
    s.net.advance(AFTER_DEFAULT_TTL);
    expect(needsRestore(s)).toBe(true);
  });

  it('with extend_ttl the entry is still live past its default TTL', () => {
    const s = session();
    s.net.invoke(s.id, 'put', [sym('k'), i128(7n)]);
    expect(s.net.invoke(s.id, 'bump', [sym('k')]).report.ok).toBe(true);
    s.net.advance(AFTER_DEFAULT_TTL);
    expect(needsRestore(s)).toBe(false);
  });

  it('a simulated bump (commit: false) extends nothing', () => {
    const s = session();
    s.net.invoke(s.id, 'put', [sym('k'), i128(7n)]);
    s.net.invoke(s.id, 'bump', [sym('k')], { commit: false });
    s.net.advance(AFTER_DEFAULT_TTL);
    expect(needsRestore(s)).toBe(true);
  });
});
