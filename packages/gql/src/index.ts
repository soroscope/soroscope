/** Maturity of this package. Nothing here is implemented yet. */
export const status = 'scaffold' as const;

import type { NetworkId, RpcCaller } from '@soroscope/core';

export interface GqlGatewayOptions {
  /** Contract to expose. */
  contractId: string;
  /** RPC endpoint or router to read through. */
  rpc: RpcCaller;
  /** Network the contract lives on. */
  network: NetworkId;
}
