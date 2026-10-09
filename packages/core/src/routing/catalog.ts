export type NetworkId = 'testnet' | 'mainnet';

export const NETWORK_PASSPHRASES: Readonly<Record<NetworkId, string>> = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
};

export interface CatalogEntry {
  url: string;
  note: string;
  /** Date this entry was last confirmed to answer `getHealth` on the network. */
  verifiedAt: string;
}

/**
 * Public Stellar RPC endpoints, each confirmed with `soroscope probe`. An
 * entry means "answered getHealth with the right network on `verifiedAt`", not
 * "is production-grade". Public endpoints change; run `soroscope probe` for the
 * current picture. No endpoint is listed that was not seen working.
 */
export const PUBLIC_PROVIDERS: Readonly<Record<NetworkId, readonly CatalogEntry[]>> = {
  testnet: [
    {
      url: 'https://soroban-testnet.stellar.org',
      note: 'Stellar Development Foundation',
      verifiedAt: '2026-10-09',
    },
    {
      url: 'https://soroban-rpc.testnet.stellar.gateway.fm',
      note: 'Gateway.fm',
      verifiedAt: '2026-10-09',
    },
  ],
  mainnet: [
    {
      url: 'https://mainnet.sorobanrpc.com',
      note: 'getLedgers reaches far beyond the advertised 7-day window',
      verifiedAt: '2026-10-09',
    },
    {
      url: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
      note: 'Gateway.fm',
      verifiedAt: '2026-10-09',
    },
    {
      url: 'https://rpc.lightsail.network',
      note: 'Lightsail Network',
      verifiedAt: '2026-10-09',
    },
    {
      url: 'https://soroban-rpc.creit.tech',
      note: 'Creit Tech; advertised window is only about 1 day',
      verifiedAt: '2026-10-09',
    },
    {
      url: 'https://archive-rpc.lightsail.network',
      note: 'Advertised window is only ~64 ledgers, but getLedgers serves deep history',
      verifiedAt: '2026-10-09',
    },
  ],
};

/** URLs of the verified public providers for a network. */
export function publicProviderUrls(network: NetworkId): string[] {
  return PUBLIC_PROVIDERS[network].map((e) => e.url);
}
