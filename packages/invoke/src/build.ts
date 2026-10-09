import { Account, BASE_FEE, Contract, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
import type { contract } from '@stellar/stellar-sdk';
import { toScVals } from './args';
import type { InvocationArgs } from './args';

export interface BuildInvocationOptions {
  contractId: string;
  function: string;
  args?: InvocationArgs;
  /** Public `G...` address the transaction is built for. Need not exist on the ledger to simulate. */
  source: string;
  networkPassphrase: string;
  /** The contract's spec, required for named arguments. */
  spec?: contract.Spec | null;
  /** Account sequence number. Simulation ignores it; a real submission needs the live value. */
  sequence?: string;
  /** Inclusion fee in stroops. Default 100. */
  fee?: string;
}

/**
 * Build an UNSIGNED transaction that calls a contract function, returned as
 * base64 XDR. It holds no keys and cannot be submitted as is: it exists to be
 * simulated, which needs only a valid source address.
 * @throws {TypeError} If an address is malformed or an argument does not fit the function.
 */
export function buildInvocationXdr(options: BuildInvocationOptions): string {
  if (!StrKey.isValidEd25519PublicKey(options.source)) {
    throw new TypeError(`"${options.source}" is not a valid G... source address`);
  }
  if (!StrKey.isValidContract(options.contractId)) {
    throw new TypeError(`"${options.contractId}" is not a valid C... contract id`);
  }
  const scArgs = toScVals(options.function, options.args, options.spec ?? null);
  const account = new Account(options.source, options.sequence ?? '0');
  return new TransactionBuilder(account, {
    fee: options.fee ?? BASE_FEE,
    networkPassphrase: options.networkPassphrase,
  })
    .addOperation(new Contract(options.contractId).call(options.function, ...scArgs))
    .setTimeout(300)
    .build()
    .toXDR();
}
