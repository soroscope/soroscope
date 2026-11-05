import { createHash } from 'node:crypto';
import { decodeSimulationResponse } from '@soroscope/core';
import { describe, expect, it } from 'vitest';
import { LocalNetwork } from '../../src';
import { fixture, fixture29, recordedAtOf, type ParityFixture } from './helpers';

// Each fixture holds live testnet `simulateTransaction` responses for calls on a
// contract built from these exact WASM bytes, and the network configuration of
// the same moment. The engine must compute the same numbers, not similar ones,
// on the host for that fixture's protocol.
describe.each<[string, ParityFixture]>([
  ['protocol 30', fixture],
  ['protocol 29', fixture29],
])('parity with live testnet simulateTransaction (%s)', (_name, fx) => {
  const v2Wasm = Buffer.from(fx.v2Wasm, 'base64');
  const net = LocalNetwork.create(fx, { timestamp: recordedAtOf(fx) });
  const { contractId, wasmHash } = net.deploy(v2Wasm);

  it('ran on the host for the protocol it was recorded on', () => {
    expect(net.protocol).toBe(fx.protocolVersion);
  });

  it('ran the same code the network ran', () => {
    expect(wasmHash).toBe(fx.live.wasmHash);
    expect(createHash('sha256').update(v2Wasm).digest('hex')).toBe(fx.live.wasmHash);
  });

  for (const call of fx.calls) {
    const label = `${call.fn}(${call.args.length} arg${call.args.length === 1 ? '' : 's'})`;
    it(`${label}: same outcome, instructions, bytes, footprint and resource fee`, () => {
      const live = decodeSimulationResponse(call.live);
      const local = net.invoke(contractId, call.fn, call.args, { commit: false }).report;

      expect(local.ok).toBe(live.ok);
      if (!live.ok) {
        expect(local.failure?.error).toEqual(live.failure?.error);
        return;
      }
      expect(call.live.results?.[0]?.xdr).toBeDefined();
      expect(local.returnValue).toEqual(live.returnValue);
      expect(local.auth.length).toBe(live.auth.length);
      expect(local.minResourceFee).toBe(live.minResourceFee);

      const l = live.transactionData!.resources;
      const m = local.transactionData!.resources;
      expect(m.instructions).toBe(l.instructions);
      expect(m.diskReadBytes).toBe(l.diskReadBytes);
      expect(m.writeBytes).toBe(l.writeBytes);
      expect(m.footprint.readOnly.length).toBe(l.footprint.readOnly.length);
      expect(m.footprint.readWrite.length).toBe(l.footprint.readWrite.length);
    });
  }
});
