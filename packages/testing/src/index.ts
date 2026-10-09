/** Maturity of this package. Nothing here is implemented yet. */
export const status = 'scaffold' as const;

import type { RpcCaller } from '@soroscope/core';

export interface ForkOptions {
  /** RPC endpoint or router the fork reads missing state from. */
  rpc: RpcCaller;
  /** Ledger to fork at. Defaults to the latest ledger. */
  ledger?: number;
}
