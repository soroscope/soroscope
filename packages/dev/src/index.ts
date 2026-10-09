/** Maturity of this package. Nothing here is implemented yet. */
export const status = 'scaffold' as const;

export interface DevLoopOptions {
  /** Directory containing the contract's Cargo project. */
  projectDir: string;
  /** Local network RPC URL. Signing is only ever done with a throwaway key on this network. */
  rpcUrl: string;
}
