import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { assertPublicHttpsUrl, containsSecretSeed, rejectSecrets, SecretInInputError } from '../../src';

describe('secret seed detection', () => {
  const seed = Keypair.random().secret();
  const pub = Keypair.random().publicKey();

  it('finds a real secret seed anywhere in a string', () => {
    expect(containsSecretSeed(seed)).toBe(true);
    expect(containsSecretSeed(`please sign with ${seed} thanks`)).toBe(true);
  });

  it('ignores public keys, contract ids and look-alikes with a bad checksum', () => {
    expect(containsSecretSeed(pub)).toBe(false);
    expect(containsSecretSeed('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC')).toBe(false);
    expect(containsSecretSeed(`S${'A'.repeat(55)}`)).toBe(false);
  });

  it('rejectSecrets looks through nested objects, arrays and keys', () => {
    expect(() => rejectSecrets({ a: { b: [1, 'x', seed] } })).toThrow(SecretInInputError);
    expect(() => rejectSecrets({ [seed]: 1 })).toThrow(SecretInInputError);
    expect(() => rejectSecrets({ a: [pub, 'hello', 3, null] })).not.toThrow();
  });
});

describe('custom RPC URL policy', () => {
  it.each([
    ['plain http', 'http://soroban-testnet.stellar.org'],
    ['localhost', 'https://localhost/rpc'],
    ['loopback address', 'https://127.0.0.1/rpc'],
    ['private 10.x', 'https://10.0.0.5/rpc'],
    ['private 192.168.x', 'https://192.168.1.1/rpc'],
    ['private 172.16.x', 'https://172.20.0.1/rpc'],
    ['cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
    ['IPv6 loopback', 'https://[::1]/rpc'],
    ['internal suffix', 'https://db.internal/rpc'],
    ['embedded credentials', 'https://user:pass@soroban-testnet.stellar.org'],
    ['not a URL', 'nope'],
  ])('rejects %s', async (_label, url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow();
  });

  it('accepts a real public https endpoint (resolved through real DNS)', { timeout: 30_000 }, async () => {
    await expect(assertPublicHttpsUrl('https://soroban-testnet.stellar.org')).resolves.toBeUndefined();
  });
});
