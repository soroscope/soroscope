import { readFileSync } from 'node:fs';
import {
  ContractSpec,
  SoroscopeRouter,
  fetchContractSpec,
  formatSpecType,
  parseWasm,
  toJsonSafe,
} from '@soroscope/core';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';
import { resolveProviders } from '../providers';
import type { GlobalOptions } from '../providers';

export interface SpecOptions extends GlobalOptions {
  json?: boolean;
}

async function load(target: string, opts: GlobalOptions): Promise<ContractSpec> {
  if (/^C[A-Z2-7]{55}$/.test(target)) {
    const router = await SoroscopeRouter.create({ providers: resolveProviders(opts).urls });
    try {
      return await fetchContractSpec(router, target);
    } finally {
      router.stop();
    }
  }
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(target);
  } catch {
    throw new CliError(`"${target}" is neither a contract id (C...) nor a readable .wasm file.`, ExitCode.Usage);
  }
  const parsed = parseWasm(bytes);
  return new ContractSpec(parsed.spec, { kind: 'unknown' }, parsed.meta);
}

/** Print a contract's functions, error codes and types, from its id or a local WASM file. */
export async function runSpec(target: string, opts: SpecOptions, io: Io): Promise<ExitCodeValue> {
  const spec = await load(target, opts);
  if (opts.json === true) {
    io.out(JSON.stringify(toJsonSafe({ source: spec.source, meta: spec.meta, entries: spec.entries }), null, 2));
    return ExitCode.Ok;
  }
  if (spec.source.kind === 'stellarAsset') {
    io.out('This is a Stellar Asset Contract: it has no WASM spec. Its interface is the standard token interface (SEP-41).');
    return ExitCode.Ok;
  }
  const lines: string[] = [];
  if (spec.functions.length > 0) {
    lines.push('Functions');
    for (const f of spec.functions) {
      const params = f.inputs.map((i) => `${i.name}: ${formatSpecType(i.type)}`).join(', ');
      const ret = f.outputs[0] === undefined ? '' : ` -> ${formatSpecType(f.outputs[0])}`;
      lines.push(`  ${f.name}(${params})${ret}`);
    }
  }
  if (spec.errors.length > 0) {
    lines.push('', 'Errors');
    for (const e of spec.errors) lines.push(`  #${e.code}  ${e.enumName}::${e.name}${e.doc === '' ? '' : `  ${e.doc.split('\n')[0]}`}`);
  }
  if (spec.events.length > 0) {
    lines.push('', 'Events');
    for (const e of spec.events) lines.push(`  ${e.name}(${e.params.map((p) => `${p.name}: ${formatSpecType(p.type)}`).join(', ')})`);
  }
  const types = [...spec.structs.map((s) => `struct ${s.name}`), ...spec.unions.map((u) => `union ${u.name}`), ...spec.enums.map((e) => `enum ${e.name}`)];
  if (types.length > 0) lines.push('', 'Types', ...types.map((t) => `  ${t}`));
  io.out(lines.join('\n'));
  return ExitCode.Ok;
}
