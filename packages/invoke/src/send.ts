import { Account, Keypair, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import { decodeSimulationResponse } from '@soroscope/core';
import type { RawSimulateResponse, RpcCaller, SimulationReport } from '@soroscope/core';

const POLL_INTERVAL_MS = 1_500;
const DEFAULT_WAIT_MS = 60_000;

/** The outcome of a submitted transaction once it is in a ledger. */
export interface SubmittedTransaction {
  hash: string;
  status: 'SUCCESS' | 'FAILED';
  ledger: number;
  /** Base64 `TransactionResult`. */
  resultXdr: string;
  /** Base64 `TransactionMeta`. */
  resultMetaXdr: string;
  /** The raw `getTransaction` response. */
  raw: Record<string, unknown>;
}

interface SendResponse {
  status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR';
  hash: string;
  errorResultXdr?: string;
}

/** Thrown when a submission is rejected, fails on chain, or does not land in time. */
export class SubmissionError extends Error {
  readonly hash: string | null;
  readonly resultXdr: string | null;

  constructor(message: string, hash: string | null, resultXdr: string | null = null) {
    super(message);
    this.name = 'SubmissionError';
    this.hash = hash;
    this.resultXdr = resultXdr;
  }
}

/**
 * Turn an unsigned transaction and its simulation into one ready to sign:
 * attach the footprint and resource budget, the authorizations the simulation
 * reports, and a fee that covers the resource fee.
 */
export function assembleTransaction(unsigned: Transaction, raw: RawSimulateResponse): Transaction {
  if (raw.error !== undefined || raw.transactionData === undefined || raw.minResourceFee === undefined) {
    throw new SubmissionError(`Cannot assemble a failed simulation: ${raw.error ?? 'no transaction data'}`, null);
  }
  const op = unsigned.operations[0];
  if (unsigned.operations.length !== 1 || op === undefined || op.type !== 'invokeHostFunction') {
    throw new TypeError('assembleTransaction only supports a single invokeHostFunction operation');
  }
  const auth = (raw.results?.[0]?.auth ?? []).map((a) => xdr.SorobanAuthorizationEntry.fromXDR(a, 'base64'));
  const fee = (BigInt(unsigned.fee) + BigInt(raw.minResourceFee)).toString();
  // TransactionBuilder increments the account's sequence number, so start one below the built value.
  const account = new Account(unsigned.source, (BigInt(unsigned.sequence) - 1n).toString());
  return new TransactionBuilder(account, {
    fee,
    networkPassphrase: unsigned.networkPassphrase,
    sorobanData: xdr.SorobanTransactionData.fromXDR(raw.transactionData, 'base64'),
  })
    .addOperation(Operation.invokeHostFunction({ func: op.func, auth }))
    .setTimeout(300)
    .build();
}

/**
 * Sign and submit a transaction, then wait until it is in a ledger.
 * @throws {SubmissionError} If the network rejects it, it fails on chain, or `waitMs` elapses.
 */
export async function signAndSend(
  rpc: RpcCaller,
  tx: Transaction,
  signer: Keypair,
  waitMs: number = DEFAULT_WAIT_MS,
): Promise<SubmittedTransaction> {
  tx.sign(signer);
  const sent = await rpc.call<SendResponse>('sendTransaction', { transaction: tx.toXDR() });
  if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
    throw new SubmissionError(`Transaction rejected (${sent.status})`, sent.hash, sent.errorResultXdr ?? null);
  }
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    let res: (Record<string, unknown> & { status: string }) | undefined;
    try {
      res = await rpc.call<Record<string, unknown> & { status: string }>('getTransaction', { hash: sent.hash });
    } catch {
      // The transaction is already submitted. A dropped poll says nothing about whether it landed:
      // keep waiting until the deadline instead of abandoning it.
    }
    if (res !== undefined && (res.status === 'SUCCESS' || res.status === 'FAILED')) {
      const out: SubmittedTransaction = {
        hash: sent.hash,
        status: res.status,
        ledger: Number(res['ledger']),
        resultXdr: String(res['resultXdr']),
        resultMetaXdr: String(res['resultMetaXdr']),
        raw: res,
      };
      if (res.status === 'FAILED') {
        throw new SubmissionError(`Transaction ${sent.hash} failed on chain`, sent.hash, out.resultXdr);
      }
      return out;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new SubmissionError(`Transaction ${sent.hash} was not in a ledger after ${waitMs}ms`, sent.hash);
}

/** Simulate a built transaction and return both the decoded report and the raw response. */
export async function simulateRaw(
  rpc: RpcCaller,
  transactionXdr: string,
): Promise<{ raw: RawSimulateResponse; report: SimulationReport }> {
  const raw = await rpc.call<RawSimulateResponse>('simulateTransaction', { transaction: transactionXdr });
  return { raw, report: decodeSimulationResponse(raw) };
}
