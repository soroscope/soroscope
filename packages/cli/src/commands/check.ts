import { writeFileSync } from 'node:fs';
import { ConfigError, loadConfig, renderMarkdown, renderText, runChecks } from '@soroscope/ci';
import { toJsonSafe } from '@soroscope/core';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';

export interface CheckOptions {
  config: string;
  updateBaseline?: boolean;
  format: string;
  failOn: string;
  /** Name of an environment variable holding a funded test-network secret key to deploy with. */
  deployerSecretEnv?: string;
  /** Also write the markdown report to this file (for PR comments). */
  markdownOut?: string;
}

/**
 * Measure the invocations in a soroscope.config.json and compare with the
 * baseline. This is the same engine the GitHub Action runs.
 */
export async function runCheck(opts: CheckOptions, io: Io): Promise<ExitCodeValue> {
  let loaded;
  try {
    loaded = loadConfig(opts.config);
  } catch (err) {
    if (err instanceof ConfigError) throw new CliError(err.message, ExitCode.Usage);
    throw err;
  }
  let deployerSecret: string | undefined;
  if (opts.deployerSecretEnv !== undefined) {
    deployerSecret = process.env[opts.deployerSecretEnv];
    if (deployerSecret === undefined || deployerSecret === '') {
      throw new CliError(`Environment variable ${opts.deployerSecretEnv} is not set.`, ExitCode.Usage);
    }
  }
  const result = await runChecks({
    loaded,
    ...(opts.updateBaseline === true ? { updateBaseline: true } : {}),
    ...(deployerSecret === undefined ? {} : { deployerSecret }),
    log: (m) => io.err(m),
  });
  const { report } = result;

  if (opts.markdownOut !== undefined) writeFileSync(opts.markdownOut, renderMarkdown(report));
  if (opts.format === 'json') io.out(JSON.stringify(toJsonSafe(report), null, 2));
  else if (opts.format === 'markdown') io.out(renderMarkdown(report));
  else io.out(renderText(report));
  if (result.baselineWritten) io.err(`Baseline written to ${result.baselinePath}`);

  if (opts.updateBaseline === true) return ExitCode.Ok;
  if (report.result === 'fail') return ExitCode.Failure;
  if (report.result === 'warn' && opts.failOn === 'warning') return ExitCode.Failure;
  return ExitCode.Ok;
}
