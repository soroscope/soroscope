import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Contract, Keypair, Networks, StrKey } from '@stellar/stellar-sdk';
import type { contract } from '@stellar/stellar-sdk';
import {
  NETWORK_PASSPHRASES,
  SoroscopeRouter,
  TransactionSimulator,
  publicProviderUrls,
} from '@soroscope/core';
import type { RpcCaller } from '@soroscope/core';
import {
  buildInvocationXdr,
  deployWasm,
  friendbotUrlFor,
  fundWithFriendbot,
  loadSpec,
  sendInvocation,
  specFromWasm,
  toScVals,
} from '@soroscope/invoke';
import type { InvocationArgs } from '@soroscope/invoke';
import { readBaseline, writeBaseline } from './baseline';
import type { Baseline, BaselineEntry } from './baseline';
import { compareAll } from './compare';
import type { CheckReport } from './compare';
import type { InvocationConfig, LoadedConfig } from './config';
import { measure } from './metrics';
import type { Measurement } from './metrics';

const TOOL = '@soroscope/ci';

export interface RunOptions {
  loaded: LoadedConfig;
  /** Record the current numbers as the new baseline instead of comparing. */
  updateBaseline?: boolean;
  /** Use this caller instead of building a router from the config (tests, custom setups). */
  rpc?: RpcCaller;
  /** Secret key (`S...`) of a funded test-network account to deploy with, instead of a throwaway one. */
  deployerSecret?: string;
  log?: (message: string) => void;
}

export interface RunResult {
  report: CheckReport;
  baselinePath: string;
  baselineWritten: boolean;
  /** Contracts deployed from local WASM during this run (Mode B). */
  deployed: Record<string, { contractId: string; wasmHash: string }>;
}

/** Replace string values that are exactly `$name` with the variable's value, recursively. */
export function substitute(value: unknown, vars: Readonly<Record<string, string>>): unknown {
  if (typeof value === 'string') {
    return value.startsWith('$') && vars[value.slice(1)] !== undefined ? vars[value.slice(1)] : value;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
  }
  return value;
}

/** A well-formed source address for simulations that need no real account. */
function placeholderSource(): string {
  return StrKey.encodeEd25519PublicKey(Buffer.alloc(32));
}

async function protocolVersionOf(router: SoroscopeRouter | null, rpc: RpcCaller): Promise<number | null> {
  if (router !== null) {
    const versions = router.registry
      .list()
      .map((r) => r.chain.protocolVersion)
      .filter((v): v is number => v !== null);
    if (versions.length > 0) return Math.max(...versions);
  }
  try {
    return (await rpc.call<{ protocolVersion: number }>('getNetwork')).protocolVersion;
  } catch {
    return null;
  }
}

/**
 * Measure every invocation in the config and compare with the baseline.
 *
 * Mode A: invocations name a deployed `contractId` and are simulated as is.
 * Mode B: `contracts` entries point at compiled WASM; they are deployed to the
 * test network with a throwaway key funded by friendbot (or `deployerSecret`),
 * set up, then simulated. This is what measures a pull request's own code.
 */
export async function runChecks(options: RunOptions): Promise<RunResult> {
  const { loaded } = options;
  const { config } = loaded;
  const log = options.log ?? ((): void => undefined);

  const passphrase = NETWORK_PASSPHRASES[config.network.name];
  const router =
    options.rpc === undefined
      ? await SoroscopeRouter.create({ providers: config.network.rpc ?? publicProviderUrls(config.network.name) })
      : null;
  const rpc: RpcCaller = options.rpc ?? router!;

  const deployed: RunResult['deployed'] = {};
  const specs = new Map<string, contract.Spec | null>();
  const vars: Record<string, string> = {};
  const aliasOf: Record<string, string> = {};
  const wasmHashes: Record<string, string> = {};

  const aliases = Object.keys(config.contracts);
  if (aliases.length > 0) {
    if (config.network.name !== 'testnet') {
      throw new Error(
        'Deploying contracts from WASM is only done on testnet, with a throwaway key. Point invocations at a deployed contractId to measure on mainnet.',
      );
    }
    const signer = options.deployerSecret === undefined ? Keypair.random() : Keypair.fromSecret(options.deployerSecret);
    if (options.deployerSecret === undefined) {
      log(`Funding a throwaway deployer ${signer.publicKey()} from friendbot`);
      await fundWithFriendbot(friendbotUrlFor(Networks.TESTNET)!, signer.publicKey());
    }
    vars['deployer'] = signer.publicKey();
    aliasOf[signer.publicKey()] = '$deployer';
    for (const alias of aliases) {
      const c = config.contracts[alias]!;
      const wasm = readFileSync(resolve(loaded.dir, c.wasm));
      log(`Deploying ${alias} (${wasm.length} bytes)`);
      const result = await deployWasm({ rpc, wasm, signer, networkPassphrase: passphrase });
      deployed[alias] = result;
      vars[alias] = result.contractId;
      aliasOf[result.contractId] = `$${alias}`;
      wasmHashes[alias] = createHash('sha256').update(wasm).digest('hex');
      const spec = specFromWasm(wasm);
      specs.set(result.contractId, spec);
      for (const call of c.setup ?? []) {
        log(`  ${alias}.${call.function}(...)`);
        const args = substitute(call.args, vars) as InvocationArgs | undefined;
        await sendInvocation({
          rpc,
          signer,
          networkPassphrase: passphrase,
          build: (b) => b.addOperation(new Contract(result.contractId).call(call.function, ...toScVals(call.function, args, spec))),
        });
      }
    }
  }

  const sim = new TransactionSimulator(rpc);
  const measurements: Record<string, { function: string; measurement: Measurement; wasmSha256?: string }> = {};
  for (const inv of config.invocations) {
    const contractId = resolveContractId(inv, vars);
    if (!specs.has(contractId)) specs.set(contractId, (await loadSpec(rpc, contractId)).spec);
    const source = String(substitute(inv.source ?? config.defaults.source ?? placeholderSource(), vars));
    const args = substitute(inv.args, vars) as InvocationArgs | undefined;
    log(`Simulating ${inv.name}`);
    let xdr: string;
    try {
      xdr = buildInvocationXdr({
        contractId,
        function: inv.function,
        ...(args === undefined ? {} : { args }),
        source,
        networkPassphrase: passphrase,
        spec: specs.get(contractId) ?? null,
      });
    } catch (err) {
      throw new Error(`Invocation "${inv.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
    const report = await sim.simulateAndExplain(xdr);
    measurements[inv.name] = {
      function: inv.function,
      measurement: measure(report, aliasOf),
      ...(inv.contract === undefined ? {} : { wasmSha256: wasmHashes[inv.contract]! }),
    };
  }

  const environment = {
    network: config.network.name,
    protocolVersion: await protocolVersionOf(router, rpc),
  };
  const baselinePath = resolve(loaded.dir, config.baseline);
  const baseline = readBaseline(baselinePath);
  const report = compareAll({ config, measurements, baseline, environment });

  let baselineWritten = false;
  if (options.updateBaseline === true) {
    const entries: Record<string, BaselineEntry> = {};
    for (const [name, m] of Object.entries(measurements)) {
      entries[name] = { ...m.measurement, function: m.function, ...(m.wasmSha256 === undefined ? {} : { wasmSha256: m.wasmSha256 }) };
    }
    const next: Baseline = {
      version: 1,
      generatedAt: new Date().toISOString(),
      tool: TOOL,
      environment,
      entries,
    };
    writeBaseline(baselinePath, next);
    baselineWritten = true;
  }
  router?.stop();
  return { report, baselinePath, baselineWritten, deployed };
}

function resolveContractId(inv: InvocationConfig, vars: Readonly<Record<string, string>>): string {
  if (inv.contractId !== undefined) return inv.contractId;
  const id = vars[inv.contract!];
  if (id === undefined) throw new Error(`Invocation "${inv.name}" refers to contract "${inv.contract}" which was not deployed`);
  return id;
}
