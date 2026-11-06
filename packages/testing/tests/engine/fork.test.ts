import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalLedgerKey } from '@soroscope/core';
import { describe, expect, it } from 'vitest';
import { replayFork, type ForkRecording } from '../../src';

// tests/fixtures/fork-mainnet.json was recorded from live MAINNET by
// packages/test-utils/scripts/record-fork-parity.mjs: Stellar RPC's own simulation of calls
// to real contracts, and the live ledger entries each one touches, read at the same ledger.
// Replaying them runs the protocol 29 host on real mainnet state and must give the network's
// own answer, not a similar one.
const recording = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/fork-mainnet.json'), 'utf8')) as ForkRecording;

const label = (c: { contractId: string; fn: string }): string => `${c.fn} on ${c.contractId.slice(0, 6)}…`;

describe('forking live mainnet', () => {
  it('was recorded from mainnet, on the protocol its host emulates', () => {
    expect(recording.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    expect(recording.protocolVersion).toBe(29);
  });

  const results = replayFork(recording);

  it('covers more than the fixture contract: token reads, a transfer, a cross-contract call', () => {
    expect(results.map((r) => r.call.fn)).toEqual(['name', 'balance', 'balance', 'transfer', 'router_get_amounts_out']);
    // The router call reaches into a second contract: two contracts' state and two codes.
    const router = results.find((r) => r.call.fn === 'router_get_amounts_out')!;
    const fp = router.live.transactionData!.resources.footprint;
    const keys = [...fp.readOnly, ...fp.readWrite].map((k) => canonicalLedgerKey(k));
    const contracts = new Set(keys.filter((k) => k.startsWith('contractData:')).map((k) => k.split(':')[2]));
    expect(contracts.size).toBeGreaterThanOrEqual(2);
    expect(keys.filter((k) => k.startsWith('contractCode:')).length).toBeGreaterThanOrEqual(2);
  });

  for (const r of results) {
    it(`${label(r.call)}: the engine reproduces the network exactly`, () => {
      expect(r.live.ok).toBe(true);
      expect(r.local.report.ok).toBe(true);
      // Outcome, return value, auth, fee, instructions, read and write bytes, footprint.
      expect(r.differences).toEqual([]);
    });
  }

  it('a USDC transfer moves classic trustline entries, so those writes are accounted for', () => {
    const transfer = results.find((r) => r.call.fn === 'transfer')!;
    expect(transfer.local.report.transactionData!.resources.writeBytes).toBeGreaterThan(0);
    expect(transfer.local.report.transactionData!.resources.writeBytes).toBe(transfer.live.transactionData!.resources.writeBytes);
  });

  it('has teeth: dropping an entry\'s sponsorship extension makes the comparison fail', () => {
    // Sponsored classic entries are 44 bytes larger; ignoring `extXdr` was a real bug that
    // this comparison caught. If it stops catching it, the comparison has gone blind.
    const stripped: ForkRecording = {
      ...recording,
      calls: recording.calls.map((c) => ({ ...c, entries: c.entries.map(({ extXdr: _ext, ...rest }) => rest) })),
    };
    const sponsored = recording.calls.flatMap((c) => c.entries).some((e) => e.extXdr !== undefined);
    expect(sponsored, 'the recording should include at least one entry with an extension').toBe(true);
    const fields = replayFork(stripped).flatMap((r) => r.differences.map((d) => d.field));
    expect(fields).toContain('diskReadBytes');
  });
});
