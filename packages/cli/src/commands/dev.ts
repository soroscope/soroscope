import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { SoroscopeRouter } from '@soroscope/core';
import type * as Dev from '@soroscope/dev';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';
import { resolveProviders } from '../providers';
import type { GlobalOptions } from '../providers';

const PASSPHRASES = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
} as const;

export interface DevOptions extends GlobalOptions {
  builder?: 'stellar' | 'cargo';
  /** JSON object of named constructor arguments for the first deploy. */
  init?: string;
}

/** A REPL line, parsed. */
export type ReplInput =
  | { kind: 'empty' }
  | { kind: 'call'; fn: string; args: Record<string, unknown>; commit: boolean }
  | { kind: 'command'; name: string; rest: string[] };

/** Split on whitespace, keeping quoted strings and bracketed JSON together. */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | null = null;
  for (const ch of line) {
    if (quote !== null) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '{' || ch === '[') {
      depth += 1;
      cur += ch;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
      cur += ch;
    } else if (/\s/.test(ch) && depth === 0) {
      if (cur !== '') tokens.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (quote !== null || depth !== 0) throw new Error('Unbalanced quotes or brackets.');
  if (cur !== '') tokens.push(cur);
  return tokens;
}

/** A value as typed: JSON when it parses (`5`, `"x"`, `[1,2]`, `true`), otherwise the bare text (`G...`, `k`). */
function parseValue(raw: string): unknown {
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) return raw.slice(1, -1);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/**
 * Parse one REPL line: `fn name=value ...` calls and keeps the writes;
 * `?fn name=value ...` only simulates; `.command args` runs a command.
 */
export function parseReplLine(line: string): ReplInput {
  const tokens = tokenize(line.trim());
  const [head, ...rest] = tokens;
  if (head === undefined) return { kind: 'empty' };
  if (head.startsWith('.')) return { kind: 'command', name: head.slice(1), rest };
  const commit = !head.startsWith('?');
  const fn = commit ? head : head.slice(1);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fn)) throw new Error(`"${fn}" is not a function name.`);
  const args: Record<string, unknown> = {};
  for (const t of rest) {
    const eq = t.indexOf('=');
    if (eq <= 0) throw new Error(`Arguments are name=value; got "${t}".`);
    args[t.slice(0, eq)] = parseValue(t.slice(eq + 1));
  }
  return { kind: 'call', fn, args, commit };
}

const n = (x: number | bigint): string => x.toLocaleString('en-US');
const short = (id: string): string => `${id.slice(0, 4)}…${id.slice(-4)}`;

function show(v: unknown): string {
  if (typeof v === 'string' && /^[GC][A-Z2-7]{55}$/.test(v)) return short(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`;
  if (v !== null && typeof v === 'object') {
    return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${show(x)}`).join(', ')} }`;
  }
  return String(v);
}

/** Render a call's outcome for the terminal. */
export function formatOutcome(o: Dev.CallOutcome): string {
  const lines: string[] = [];
  if (o.report.ok) {
    lines.push(`← ${o.value === null ? '()' : show(o.value)}${o.committed ? '' : '   (simulated, not applied)'}`);
  } else if (o.errorCase !== null) {
    const doc = o.errorCase.doc === '' ? '' : `: ${o.errorCase.doc}`;
    lines.push(`✗ Error #${o.errorCase.code} ${o.errorCase.name}${doc}`);
  } else {
    lines.push(`✗ ${o.summary.replace(/^Simulation failed: /, '')}`);
  }
  for (const e of o.events) {
    lines.push(e.name === null ? `  event   ${show(e.topics)} ${show(e.data)}` : `  event   ${e.name} ${show(e.fields)}`);
  }
  const td = o.report.transactionData;
  const parts = [`${n(o.cpuInstructions)} instructions`, `${n(o.memoryBytes)} bytes memory`];
  if (td !== null) {
    parts.push(`${td.resources.footprint.readOnly.length + td.resources.footprint.readWrite.length} entries (${td.resources.footprint.readWrite.length} written)`);
    parts.push(`fee ${n(o.report.minResourceFee ?? td.resourceFee)} stroops`);
  }
  if (o.report.auth.length > 0) parts.push(`${o.report.auth.length} auth`);
  lines.push(`  cost    ${parts.join(' · ')}`);
  return lines.join('\n');
}

function formatLoopEvent(e: Dev.DevLoopEvent): string {
  switch (e.type) {
    case 'building':
      return `● building (${e.reason})…`;
    case 'build-failed': {
      const errors = e.output.split('\n').filter((l) => /^error|^\s+-->|^\s+\|/.test(l)).slice(0, 12);
      return `✗ ${e.message}\n${(errors.length > 0 ? errors : e.output.split('\n').slice(-12)).map((l) => `  ${l}`).join('\n')}`;
    }
    case 'load-failed':
      return `✗ built, but could not load: ${e.message}`;
    case 'reloaded': {
      const r = e.result;
      const secs = (e.buildMs / 1000).toFixed(1);
      if (r.kind === 'unchanged') return `✓ rebuilt in ${secs}s · code unchanged`;
      const diff = [
        ...r.diff.added.map((f) => `+${f}`),
        ...r.diff.removed.map((f) => `-${f}`),
        ...r.diff.changed.map((f) => `~${f}`),
      ];
      const what = r.kind === 'deployed' ? `deployed ${r.contractId}` : `swapped in place · ${short(r.contractId)} · storage kept`;
      return `✓ ${what} (build ${secs}s)${r.kind === 'swapped' && diff.length > 0 ? `\n  ${diff.join('  ')}` : ''}`;
    }
  }
}

const HELP = `Call a function:     mint to=me amount=1000      ("me" is the local account)
Simulate only:       ?balance who=me
Commands:            .fns  .events  .advance <ledgers>  .gen [file.ts]  .help  .exit`;

/**
 * Run `soroscope dev`: build the contract in `dir`, run it in-process, rebuild
 * and hot-swap on every save, and take calls from `input` until `.exit`.
 */
export async function runDev(
  dir: string,
  opts: DevOptions,
  io: Io,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<ExitCodeValue> {
  const dev = await import('@soroscope/dev');
  let ctorArgs: Record<string, unknown> = {};
  if (opts.init !== undefined) {
    try {
      ctorArgs = JSON.parse(opts.init) as Record<string, unknown>;
    } catch {
      throw new CliError('--init must be a JSON object of constructor arguments.', ExitCode.Usage);
    }
  }

  const selection = resolveProviders(opts);
  if (selection.network === 'custom') {
    throw new CliError('soroscope dev needs --network testnet or mainnet, to read that network\'s fee and cost settings.', ExitCode.Usage);
  }
  io.err(`reading ${selection.network} fee and cost settings…`);
  const router = await SoroscopeRouter.create({ providers: selection.urls });
  let config: Dev.NetworkConfigSnapshot;
  try {
    config = await dev.fetchNetworkConfig(router, PASSPHRASES[selection.network]);
  } finally {
    router.stop();
  }

  let session: Dev.DevSession;
  try {
    session = dev.DevSession.create(config);
  } catch (err) {
    // Both are about this machine or this network, not a bug: say so and exit as usage.
    if (err instanceof dev.EngineNotBuiltError || err instanceof dev.UnsupportedProtocolError) {
      throw new CliError(err.message, ExitCode.Usage);
    }
    throw err;
  }
  const loop = new dev.DevLoop({
    projectDir: dir,
    session,
    ...(opts.builder === undefined ? {} : { builder: opts.builder }),
    constructorArgs: ctorArgs,
    onEvent: (e): void => io.err(formatLoopEvent(e)),
  });
  try {
    await loop.start();
  } catch (err) {
    if (err instanceof dev.BuildError) throw new CliError(`${err.message}\n${err.output}`, ExitCode.Usage);
    throw err;
  }
  io.err(`local account ${session.network.sourceAccount}\n${HELP}`);

  const rl = createInterface({ input, output, prompt: 'soroscope> ', terminal: input === process.stdin && process.stdin.isTTY });
  rl.prompt();
  for await (const line of rl) {
    let parsed: ReplInput;
    try {
      parsed = parseReplLine(line);
    } catch (err) {
      io.err(`✗ ${(err as Error).message}`);
      rl.prompt();
      continue;
    }
    if (parsed.kind === 'command' && parsed.name === 'exit') break;
    try {
      handle(parsed, session, io, dir, dev.signature);
    } catch (err) {
      io.err(`✗ ${(err as Error).message}`);
    }
    rl.prompt();
  }
  rl.close();
  loop.stop();
  return ExitCode.Ok;
}

function handle(
  input: ReplInput,
  session: Dev.DevSession,
  io: Io,
  dir: string,
  signature: typeof Dev.signature,
): void {
  if (input.kind === 'empty') return;
  const iface = session.interface;
  if (input.kind === 'call') {
    io.out(formatOutcome(session.call(input.fn, input.args, { commit: input.commit })));
    return;
  }
  switch (input.name) {
    case 'help':
      io.out(HELP);
      return;
    case 'fns':
      if (iface !== null) {
        io.out(iface.functions.map((f) => `  ${signature(f)}${f.doc === undefined ? '' : `\n      ${f.doc.split('\n')[0]}`}`).join('\n'));
      }
      return;
    case 'events':
      if (iface !== null) {
        io.out(
          iface.events.length === 0
            ? '  (the spec declares no events)'
            : iface.events.map((e) => `  ${e.name} { ${[...e.topics.slice(1), ...e.data].map((f) => f.name).join(', ')} }`).join('\n'),
        );
      }
      return;
    case 'advance': {
      const count = Number(input.rest[0] ?? '1');
      if (!Number.isInteger(count) || count < 1) throw new Error('.advance takes a positive whole number of ledgers.');
      session.network.advance(count);
      io.out(`  ledger ${session.network.sequence}`);
      return;
    }
    case 'gen': {
      if (iface === null) return;
      const code = generatedSource(iface, basename(dir));
      const file = input.rest[0];
      if (file === undefined) io.out(code);
      else {
        writeFileSync(file, code);
        io.out(`  wrote ${file}`);
      }
      return;
    }
    default:
      throw new Error(`Unknown command .${input.name}. Try .help`);
  }
}

function generatedSource(iface: Dev.ContractInterface, name: string): string {
  const a = iface.generateTypes(name);
  const header = `// Generated by soroscope from the contract's embedded spec, using Orbital's codegen\n// (@orbital-stellar/abi-registry). Imports zod and @orbital-stellar/pulse-core. Do not edit.\n`;
  return `${header}\n${[a.declarations, a.schemas, a.guards].filter(Boolean).join('\n\n')}\n`;
}

export interface GenOptions extends GlobalOptions {
  out?: string;
  hooks?: boolean;
  builder?: 'stellar' | 'cargo';
}

/**
 * `soroscope gen`: TypeScript types, Zod schemas and event guards (and,
 * with --hooks, React hooks) for a contract, from a .wasm file or a crate directory.
 */
export async function runGen(target: string, opts: GenOptions, io: Io): Promise<ExitCodeValue> {
  const dev = await import('@soroscope/dev');
  let wasm: Uint8Array;
  let name: string;
  let isDir = false;
  try {
    isDir = statSync(target).isDirectory();
  } catch {
    throw new CliError(`"${target}" is not a .wasm file or a contract crate directory.`, ExitCode.Usage);
  }
  if (isDir) {
    const project = await dev.resolveProject(target);
    const builder = opts.builder ?? ((await dev.hasStellarCli()) ? 'stellar' : 'cargo');
    io.err(`building ${project.packageName}…`);
    wasm = (await dev.buildContract(project, builder)).wasm;
    name = project.packageName;
  } else {
    wasm = readFileSync(target);
    name = basename(target, '.wasm');
  }
  let iface: Dev.ContractInterface;
  try {
    iface = dev.ContractInterface.fromWasm(wasm);
  } catch (err) {
    if (err instanceof dev.NoEmbeddedSpecError) throw new CliError('That WASM has no embedded contract spec.', ExitCode.Failure);
    throw err;
  }
  let code = generatedSource(iface, name);
  if (opts.hooks === true) {
    const hooks = iface.generateTypes(name).hooks;
    if (hooks !== undefined && hooks !== '') code += `\n${hooks}\n`;
  }
  if (opts.out === undefined) io.out(code);
  else {
    writeFileSync(opts.out, code);
    io.err(`wrote ${opts.out}`);
  }
  return ExitCode.Ok;
}
