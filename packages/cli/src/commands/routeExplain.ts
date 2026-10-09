import { SoroscopeRouter } from '@soroscope/core';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';
import { resolveProviders } from '../providers';
import type { GlobalOptions } from '../providers';

export interface RouteExplainOptions extends GlobalOptions {
  startLedger?: string;
}

/**
 * Show which provider would serve a call and why the others would not,
 * without making the call. Providers are health-checked first so the answer
 * reflects their current ledger bounds.
 */
export async function runRouteExplain(
  method: string,
  paramsJson: string | undefined,
  opts: RouteExplainOptions,
  io: Io,
): Promise<ExitCodeValue> {
  const selection = resolveProviders(opts);
  let params: unknown;
  if (paramsJson !== undefined) {
    try {
      params = JSON.parse(paramsJson);
    } catch {
      throw new CliError('params must be valid JSON, for example \'{"startLedger": 123}\'.', ExitCode.Usage);
    }
  }
  const startLedger = opts.startLedger === undefined ? undefined : Number(opts.startLedger);
  if (startLedger !== undefined && !Number.isInteger(startLedger)) {
    throw new CliError('--start-ledger must be an integer.', ExitCode.Usage);
  }

  const router = await SoroscopeRouter.create({ providers: selection.urls });
  const plan = router.explain(method, params, {
    ...(startLedger === undefined ? {} : { requires: { startLedger } }),
  });
  io.out(JSON.stringify(plan, null, 2));
  return plan.chosen === undefined ? ExitCode.Network : ExitCode.Ok;
}
