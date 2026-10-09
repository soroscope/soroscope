import { contract } from '@stellar/stellar-sdk';
import { fetchContractCode } from '@soroscope/core';
import type { ContractSource, RpcCaller } from '@soroscope/core';

/** A contract's spec in the SDK's form, plus where its code comes from. */
export interface LoadedSpec {
  /** Null for the Stellar Asset Contract, which has no WASM spec. */
  spec: contract.Spec | null;
  source: ContractSource;
}

/**
 * Read a deployed contract's spec through `rpc` so named arguments can be
 * converted to the types the contract expects.
 * @throws {ContractNotFoundError} If the contract is not on the ledger.
 */
export async function loadSpec(rpc: RpcCaller, contractId: string): Promise<LoadedSpec> {
  const { source, wasm } = await fetchContractCode(rpc, contractId);
  return { spec: wasm === null ? null : contract.Spec.fromWasm(wasm), source };
}

/** Build a spec from compiled WASM bytes you already hold (for example the PR's build output). */
export function specFromWasm(wasm: Uint8Array): contract.Spec {
  return contract.Spec.fromWasm(wasm);
}
