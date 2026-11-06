import { describe, expect, it } from 'vitest';
import {
  LocalNetwork,
  UnsupportedProtocolError,
  hostProtocolVersion,
  supportedProtocols,
} from '../../src';
import { fixture, fixture29, recordedAt, recordedAtOf, v1Wasm } from './helpers';

describe('protocol support', () => {
  it('embeds a host for each protocol the recorded networks ran', () => {
    // If this fails, a recorded fixture is from a network the engine cannot emulate.
    expect(supportedProtocols()).toEqual(
      expect.arrayContaining([fixture29.protocolVersion, fixture.protocolVersion]),
    );
    expect(hostProtocolVersion()).toBe(Math.max(...supportedProtocols()));
  });

  it.each([
    ['older', fixture29],
    ['newer', fixture],
  ])("runs contracts on the %s protocol with that protocol's host", (_name, fx) => {
    const net = LocalNetwork.create(fx, { timestamp: recordedAtOf(fx) });
    expect(net.protocol).toBe(fx.protocolVersion);
    expect(net.deploy(v1Wasm).contractId).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it('refuses a network on a protocol it has no host for, naming what it does support', () => {
    const ahead = hostProtocolVersion() + 1;
    const create = (): LocalNetwork =>
      LocalNetwork.create({ ...fixture, protocolVersion: ahead }, { timestamp: recordedAt });
    expect(create).toThrow(UnsupportedProtocolError);
    try {
      create();
    } catch (e) {
      const error = e as UnsupportedProtocolError;
      expect(error.networkProtocol).toBe(ahead);
      expect(error.supportedProtocols).toEqual(supportedProtocols());
      expect(error.message).toContain(`protocol ${ahead}`);
    }
  });

  it('refuses a configuration labelled with the wrong protocol instead of failing on the first call', () => {
    // protocol 29's configuration has 86 cost types; the protocol 30 host needs 95.
    const mislabelled = { ...fixture29, protocolVersion: fixture.protocolVersion };
    expect(() => LocalNetwork.create(mislabelled, { timestamp: recordedAt })).toThrow(
      /cost model mismatch/,
    );
  });
});
