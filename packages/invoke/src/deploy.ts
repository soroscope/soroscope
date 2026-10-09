import { createHash, randomBytes } from 'node:crypto';
import { Address, BASE_FEE, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import type { RpcCaller } from '@soroscope/core';
import { loadAccount } from './account';
import { assembleTransaction, signAndSend, simulateRaw, SubmissionError } from './send';
import type { SubmittedTransaction } from './send';

export interface DeployOptions {
  rpc: RpcCaller;
  wasm: Uint8Array;
  /** Pays for and signs the upload and deployment. Use a throwaway key on a test network. */
  signer: Keypair;
  networkPassphrase: string;
}

export interface DeployedContract {
  contractId: string;
  /** Hex SHA-256 of the WASM, which is also its ledger key. */
  wasmHash: string;
}

async function prepare(
  rpc: RpcCaller,
  build: (b: TransactionBuilder) => TransactionBuilder,
  signer: Keypair,
  networkPassphrase: string,
): Promise<{ tx: Transaction; returnValue: unknown }> {
  const account = await loadAccount(rpc, signer.publicKey());
  const unsigned = build(new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase }))
    .setTimeout(300)
    .build();
  const { raw, report } = await simulateRaw(rpc, unsigned.toXDR());
  if (!report.ok) throw new SubmissionError(`Simulation failed: ${report.error ?? 'unknown error'}`, null);
  return { tx: assembleTransaction(unsigned, raw), returnValue: report.returnValue };
}

/**
 * Upload a WASM module and create a contract from it, signing with `signer`.
 * Two transactions: upload, then create. Intended for tests on test networks.
 */
export async function deployWasm(options: DeployOptions): Promise<DeployedContract> {
  const { rpc, signer, networkPassphrase } = options;
  const wasm = Buffer.from(options.wasm);
  const wasmHash = createHash('sha256').update(wasm).digest();

  const upload = await prepare(rpc, (b) => b.addOperation(Operation.uploadContractWasm({ wasm })), signer, networkPassphrase);
  await signAndSend(rpc, upload.tx, signer);

  const create = await prepare(
    rpc,
    (b) =>
      b.addOperation(
        Operation.createCustomContract({
          address: new Address(signer.publicKey()),
          wasmHash,
          salt: randomBytes(32),
        }),
      ),
    signer,
    networkPassphrase,
  );
  const rv = create.returnValue as { type?: string; value?: { address?: string } } | null;
  if (rv?.type !== 'address' || rv.value?.address === undefined) {
    throw new SubmissionError('Contract creation returned no contract address', null);
  }
  await signAndSend(rpc, create.tx, signer);
  return { contractId: rv.value.address, wasmHash: wasmHash.toString('hex') };
}

export interface SendInvocationOptions {
  rpc: RpcCaller;
  signer: Keypair;
  networkPassphrase: string;
  /** Add the invoke operation (use `Contract.call`). */
  build: (b: TransactionBuilder) => TransactionBuilder;
}

/** Simulate, assemble, sign and submit one contract call. For test networks. */
export async function sendInvocation(options: SendInvocationOptions): Promise<SubmittedTransaction> {
  const { tx } = await prepare(options.rpc, options.build, options.signer, options.networkPassphrase);
  return signAndSend(options.rpc, tx, options.signer);
}
