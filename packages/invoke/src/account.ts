import { Account, Keypair, xdr } from '@stellar/stellar-sdk';
import type { RpcCaller } from '@soroscope/core';

interface LedgerEntriesResponse {
  entries?: { xdr: string }[] | null;
}

/**
 * Load an account's current sequence number from the ledger.
 * @throws {Error} If the account does not exist.
 */
export async function loadAccount(rpc: RpcCaller, publicKey: string): Promise<Account> {
  const key = xdr.LedgerKey.account(
    new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(publicKey).xdrAccountId() }),
  ).toXDR('base64');
  const res = await rpc.call<LedgerEntriesResponse>('getLedgerEntries', { keys: [key] });
  const entry = res.entries?.[0];
  if (entry === undefined) {
    throw new Error(`Account ${publicKey} does not exist on this network. On a test network, fund it first.`);
  }
  const data = xdr.LedgerEntryData.fromXDR(entry.xdr, 'base64');
  if (data.type !== 'account') throw new Error(`Ledger entry for ${publicKey} is not an account`);
  return new Account(publicKey, data.account.seqNum.toString());
}
