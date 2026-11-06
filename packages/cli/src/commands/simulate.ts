import { Networks } from '@stellar/stellar-sdk';
import {
  NETWORK_PASSPHRASES,
  SoroscopeRouter,
  TransactionSimulator,
  describeSimulation,
  formatScVal,
  toJsonSafe,
} from '@soroscope/core';
import { buildInvocationXdr, loadSpec } from '@soroscope/invoke';
import type { InvocationArgs } from '@soroscope/invoke';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';
import { resolveProviders } from '../providers';
import type { GlobalOptions } from '../providers';

export interface SimulateCommandOptions extends GlobalOptions {
  contract: string;
  fn: string;
  args?: string;
  source?: string;
  json?: boolean;
  /** Send the same simulation to every selected provider separately and report where they disagree. */
  compare?: boolean;
}

/**
 * Simulate one contract call without signing or submitting anything.
 * `--source` need not be a funded account: simulation only needs a valid address.
 */
export async function runSimulate(opts: SimulateCommandOptions, io: Io): Promise<ExitCodeValue> {
  const selection = resolveProviders(opts);
  let args: InvocationArgs | undefined;
  if (opts.args !== undefined) {
    try {
      args = JSON.parse(opts.args) as InvocationArgs;
    } catch {
      throw new CliError('--args must be JSON: an object of named arguments, or a list of {"type","value"}.', ExitCode.Usage);
    }
  }
  const passphrase = selection.network === 'custom' ? Networks.TESTNET : NETWORK_PASSPHRASES[selection.network];
  const router = await SoroscopeRouter.create({ providers: selection.urls });
  try {
    const { spec } = await loadSpec(router, opts.contract);
    const xdr = buildInvocationXdr({
      contractId: opts.contract,
      function: opts.fn,
      ...(args === undefined ? {} : { args }),
      source: opts.source ?? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      networkPassphrase: passphrase,
      spec,
    });
    if (opts.compare === true) {
      if (selection.urls.length < 2) throw new CliError('--compare needs at least two providers (--network mainnet or testnet, or several --rpc).', ExitCode.Usage);
      const { differentialSimulate, describeDifferential } = await import('@soroscope/differential');
      const result = await differentialSimulate(xdr, { providers: selection.urls });
      io.out(describeDifferential(result));
      if (result.compared === 0) return ExitCode.Network;
      return result.disagreements.length === 0 ? ExitCode.Ok : ExitCode.Failure;
    }
    const report = await new TransactionSimulator(router).simulateAndExplain(xdr);
    if (opts.json === true) {
      io.out(JSON.stringify(toJsonSafe(report), null, 2));
    } else {
      io.out(describeSimulation(report));
      if (report.returnValue !== null) io.out(`return: ${formatScVal(report.returnValue)}`);
      for (const e of report.auth) {
        io.out(`auth: ${e.credentials.type === 'address' ? e.credentials.address.address : 'transaction source'} must authorize ${e.rootInvocation.function.type === 'contractFn' ? e.rootInvocation.function.functionName : 'contract creation'}`);
      }
    }
    return report.ok ? ExitCode.Ok : ExitCode.Failure;
  } catch (err) {
    if (err instanceof TypeError) throw new CliError(err.message, ExitCode.Usage);
    throw err;
  } finally {
    router.stop();
  }
}
