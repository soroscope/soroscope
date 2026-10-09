import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { runCheck } from './commands/check';
import { runDecode, runExplain } from './commands/decode';
import { runProbe } from './commands/probe';
import { runRouteExplain } from './commands/routeExplain';
import { runSimulate } from './commands/simulate';
import { runSpec } from './commands/spec';
import { CliError, ExitCode } from './exit';
import type { ExitCodeValue } from './exit';
import { processIo } from './io';
import type { Io } from './io';

const VERSION = '0.1.0';

const collect = (value: string, previous: string[] | undefined): string[] => [
  ...(previous ?? []),
  value,
];

function oneOf(...allowed: string[]): (value: string) => string {
  return (value) => {
    if (!allowed.includes(value)) {
      throw new InvalidArgumentError(`must be one of: ${allowed.join(', ')}`);
    }
    return value;
  };
}

/** Build the command tree. Exposed so tests and embedders can run it in-process. */
export function buildProgram(io: Io, onResult: (code: ExitCodeValue) => void): Command {
  const program = new Command();
  program
    .name('soroscope')
    .description('Probe Stellar RPC providers, decode XDR, simulate Soroban calls and guard resource budgets.')
    .version(VERSION)
    .exitOverride()
    .configureOutput({
      writeOut: (s) => io.out(s.replace(/\n$/, '')),
      writeErr: (s) => io.err(s.replace(/\n$/, '')),
    });

  const network = (cmd: Command): Command =>
    cmd
      .option('--network <name>', 'testnet or mainnet (default testnet, or SOROSCOPE_NETWORK)')
      .option('--rpc <url>', 'RPC endpoint; repeat for several (overrides --network)', collect);

  network(
    program
      .command('probe')
      .description('Measure latency, ledger lag, retention and real getLedgers reach for each RPC provider'),
  )
    .option('--samples <n>', 'getHealth samples per provider', '5')
    .option('--timeout <seconds>', 'per-request time budget', '15')
    .option('--burst <n>', 'also send n parallel requests to find the rate limit (0 = off)', '0')
    .option('--no-reach', 'skip the getLedgers reach measurement')
    .option('--format <fmt>', 'table, json or prometheus', oneOf('table', 'json', 'prometheus'), 'table')
    .option('--strict', 'exit 1 unless every provider is healthy')
    .option('--watch', 'probe repeatedly and print each report')
    .option('--interval <seconds>', 'seconds between probes for --watch / --serve', '30')
    .option('--serve <port>', 'serve /metrics (Prometheus) and /probe (JSON) on this port')
    .action(async (opts: Parameters<typeof runProbe>[0]) => {
      onResult(await runProbe(opts, io));
    });

  network(
    program
      .command('route-explain')
      .description('Show which provider would serve a call, and why the others would not')
      .argument('<method>', 'RPC method, for example getEvents')
      .argument('[params]', 'JSON params, for example \'{"startLedger": 123}\''),
  )
    .option('--start-ledger <n>', 'oldest ledger the call needs')
    .action(async (method: string, params: string | undefined, opts: Parameters<typeof runRouteExplain>[2]) => {
      onResult(await runRouteExplain(method, params, opts, io));
    });

  program
    .command('decode')
    .description('Decode base64 XDR: ScVal, DiagnosticEvent, SorobanAuthorizationEntry, SorobanTransactionData, LedgerKey, ...')
    .argument('<type>', 'XDR type, for example ScVal or DiagnosticEvent')
    .argument('<xdr>', 'base64 XDR, or - to read standard input')
    .option('--plain', 'for ScVal: print plain JSON instead of the tagged tree')
    .action((type: string, xdr: string, opts: Parameters<typeof runDecode>[2]) => {
      onResult(runDecode(type, xdr, opts, io));
    });

  program
    .command('explain')
    .description('Explain a base64 TransactionResult or error value in one line')
    .argument('<xdr>', 'base64 XDR, or - to read standard input')
    .action((xdr: string) => {
      onResult(runExplain(xdr, io));
    });

  network(
    program
      .command('spec')
      .description("Show a contract's functions, errors and events, from its id or a .wasm file")
      .argument('<contract>', 'contract id (C...) or path to a .wasm file'),
  )
    .option('--json', 'print the full spec as JSON')
    .action(async (target: string, opts: Parameters<typeof runSpec>[1]) => {
      onResult(await runSpec(target, opts, io));
    });

  network(
    program
      .command('simulate')
      .description('Simulate a contract call (nothing is signed or sent) and explain the result')
      .requiredOption('--contract <id>', 'contract id (C...)')
      .requiredOption('--fn <name>', 'function to call'),
  )
    .option('--args <json>', 'arguments: {"name": value} (uses the contract spec) or [{"type","value"}]')
    .option('--source <address>', 'source account; need not exist')
    .option('--json', 'print the full report as JSON')
    .action(async (opts: Parameters<typeof runSimulate>[0]) => {
      onResult(await runSimulate(opts, io));
    });

  program
    .command('check')
    .description('Measure the calls in soroscope.config.json and fail on resource regressions')
    .option('--config <path>', 'config file', 'soroscope.config.json')
    .option('--update-baseline', 'record the current numbers as the new baseline')
    .option('--format <fmt>', 'text, markdown or json', oneOf('text', 'markdown', 'json'), 'text')
    .option('--fail-on <level>', 'regression (default) or warning', oneOf('regression', 'warning'), 'regression')
    .option('--deployer-secret-env <name>', 'env var holding a funded testnet secret key (default: a throwaway key)')
    .option('--markdown-out <path>', 'also write the markdown report to this file')
    .action(async (opts: Parameters<typeof runCheck>[0]) => {
      onResult(await runCheck(opts, io));
    });

  return program;
}

/** Run the CLI and return its exit code. Never throws. */
export async function runCli(argv: readonly string[], io: Io = processIo): Promise<ExitCodeValue> {
  let result: ExitCodeValue = ExitCode.Ok;
  const program = buildProgram(io, (code) => {
    result = code;
  });
  try {
    await program.parseAsync([...argv], { from: 'user' });
    return result;
  } catch (err) {
    if (err instanceof CommanderError) {
      // --help and --version exit 0 through commander; real usage errors exit 2.
      return err.exitCode === 0 ? ExitCode.Ok : ExitCode.Usage;
    }
    if (err instanceof CliError) {
      io.err(`error: ${err.message}`);
      return err.exitCode;
    }
    io.err(`internal error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    return ExitCode.Internal;
  }
}
