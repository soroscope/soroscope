import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NetworkConfigSnapshot } from '../../src';
import { LocalNetwork, UnsupportedProtocolError, hostProtocolVersion } from '../../src';
import { fixture, recordedAt, v1Wasm } from './helpers';

describe('protocol guard', () => {
  it('embeds a host at or ahead of the recorded network', () => {
    // If this fails, the recorded fixture is from a network the engine cannot emulate.
    expect(hostProtocolVersion()).toBeGreaterThanOrEqual(fixture.protocolVersion);
  });

  it('accepts a network on the host protocol and runs contracts on it', () => {
    const net = LocalNetwork.create({ ...fixture, protocolVersion: hostProtocolVersion() }, { timestamp: recordedAt });
    expect(net.deploy(v1Wasm).contractId).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it('refuses a network ahead of the host, naming both protocols', () => {
    const ahead = hostProtocolVersion() + 1;
    const create = (): LocalNetwork => LocalNetwork.create({ ...fixture, protocolVersion: ahead }, { timestamp: recordedAt });
    expect(create).toThrow(UnsupportedProtocolError);
    try {
      create();
    } catch (e) {
      const error = e as UnsupportedProtocolError;
      expect(error.networkProtocol).toBe(ahead);
      expect(error.hostProtocol).toBe(hostProtocolVersion());
      expect(error.message).toContain(`protocol ${ahead}`);
    }
  });

  // testnet's configuration while it ran protocol 29: 86 cost types. The host
  // that shipped with protocol 30 defines 95 and cannot meter calls without them.
  const older = JSON.parse(
    readFileSync(resolve(__dirname, '../fixtures/network-config-protocol-29.json'), 'utf8'),
  ) as NetworkConfigSnapshot;

  it.skipIf(hostProtocolVersion() < 30)(
    'refuses a network on an older protocol whose cost model the host lacks, instead of failing on the first call',
    () => {
      const create = (): LocalNetwork => LocalNetwork.create(older, { timestamp: recordedAt });
      expect(create).toThrow(UnsupportedProtocolError);
      expect(create).toThrow(/protocol 29.*cost model/s);
    },
  );
});
