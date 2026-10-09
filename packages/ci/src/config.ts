import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const level = z.enum(['fail', 'warn', 'ignore']);

const threshold = z
  .object({
    /** Largest tolerated increase, as a percentage of the baseline value. */
    maxIncreasePct: z.number().min(0).optional(),
    /** Largest tolerated absolute increase. */
    maxIncreaseAbs: z.number().min(0).optional(),
    /** What an exceeded threshold does. */
    level: level.optional(),
  })
  .strict();

const typedArg = z.object({ type: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }).strict();

/** Arguments: named (needs the contract spec) or an ordered list of typed values. */
const args = z.union([z.record(z.string(), z.unknown()), z.array(typedArg)]);

const setupCall = z.object({ function: z.string(), args: args.optional() }).strict();

const contract = z
  .object({
    /** Path to the compiled WASM, relative to the config file. */
    wasm: z.string(),
    /** Calls made right after deployment, signed by the deployer. */
    setup: z.array(setupCall).optional(),
  })
  .strict();

const invocation = z
  .object({
    name: z.string().min(1),
    /** Alias of a contract under `contracts` (Mode B). */
    contract: z.string().optional(),
    /** Id of an already-deployed contract (Mode A). */
    contractId: z.string().optional(),
    function: z.string().min(1),
    args: args.optional(),
    /** `G...` source address, or `$deployer`. Defaults to `defaults.source`. */
    source: z.string().optional(),
    expect: z
      .object({
        /** Set false for a call that is supposed to fail. Default true. */
        success: z.boolean().optional(),
        /** For an expected failure, the contract error name it must carry. */
        errorName: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((i) => (i.contract === undefined) !== (i.contractId === undefined), {
    message: 'Give exactly one of "contract" (an alias under contracts) or "contractId"',
  });

export const configSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    network: z
      .object({
        name: z.enum(['testnet', 'mainnet']).default('testnet'),
        /** RPC endpoints; defaults to the verified public providers for the network. */
        rpc: z.array(z.string().url()).optional(),
      })
      .strict()
      .default({ name: 'testnet' }),
    /** Where the baseline lives, relative to the config file. */
    baseline: z.string().default('soroscope.baseline.json'),
    defaults: z.object({ source: z.string().optional() }).strict().default({}),
    /** Absolute ceilings that fail regardless of the baseline. */
    budgets: z
      .object({
        instructions: z.number().int().positive().optional(),
        diskReadBytes: z.number().int().nonnegative().optional(),
        writeBytes: z.number().int().nonnegative().optional(),
        resourceFee: z.union([z.string(), z.number()]).optional(),
        readWriteKeys: z.number().int().nonnegative().optional(),
      })
      .strict()
      .default({}),
    thresholds: z
      .object({
        instructions: threshold.optional(),
        diskReadBytes: threshold.optional(),
        writeBytes: threshold.optional(),
        resourceFee: threshold.optional(),
        footprint: z
          .object({
            allowNewKeys: z.boolean().optional(),
            allowReadOnlyToReadWrite: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .default({}),
    /** Fail (not just warn) when an invocation has no baseline entry yet. */
    failOnMissingBaseline: z.boolean().default(false),
    contracts: z.record(z.string(), contract).default({}),
    invocations: z.array(invocation).min(1),
  })
  .strict();

export type SoroscopeConfig = z.infer<typeof configSchema>;
export type InvocationConfig = z.infer<typeof invocation>;
export type ContractConfig = z.infer<typeof contract>;

/** A config that failed validation, with every problem listed. */
export class ConfigError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(`${message}\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/** Validate an already-parsed config object. */
export function parseConfig(input: unknown): SoroscopeConfig {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigError(
      'soroscope.config.json is invalid:',
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  const config = result.data;
  for (const [i, inv] of config.invocations.entries()) {
    if (inv.contract !== undefined && config.contracts[inv.contract] === undefined) {
      throw new ConfigError('soroscope.config.json is invalid:', [
        `invocations.${i}.contract: "${inv.contract}" is not defined under contracts`,
      ]);
    }
  }
  const names = config.invocations.map((i) => i.name);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup !== undefined) {
    throw new ConfigError('soroscope.config.json is invalid:', [`invocation name "${dup}" is used twice`]);
  }
  return config;
}

export interface LoadedConfig {
  config: SoroscopeConfig;
  /** Absolute path of the config file. */
  path: string;
  /** Directory relative paths (wasm, baseline) resolve against. */
  dir: string;
}

/** Read and validate a config file from disk. */
export function loadConfig(path: string): LoadedConfig {
  const abs = resolve(path);
  let raw: string;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    throw new ConfigError(`Cannot read ${abs}:`, [err instanceof Error ? err.message : String(err)]);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`${abs} is not valid JSON:`, [err instanceof Error ? err.message : String(err)]);
  }
  return { config: parseConfig(json), path: abs, dir: dirname(abs) };
}

/** The JSON Schema for `soroscope.config.json`, for editor validation. */
export function configJsonSchema(): unknown {
  return z.toJSONSchema(configSchema);
}
