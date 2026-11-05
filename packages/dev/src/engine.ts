import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_BINARY, detectLibc, enginePackageFor } from './platform';
import { decodeSimulationResponse, type RpcCaller, type RawSimulateResponse, type SimulationReport } from '@soroscope/core';

/**
 * A network's Soroban configuration: every CONFIG_SETTING ledger entry (fee
 * rates, cost model, TTL limits). The engine needs it to meter and price calls
 * the way that network does.
 */
export interface NetworkConfigSnapshot {
  networkPassphrase: string;
  protocolVersion: number;
  /** Ledger the snapshot was read at; the local ledger starts here. */
  latestLedger: number;
  /** As `getLedgerEntries` returns them: `xdr` is base64 `LedgerEntryData`. */
  configEntries: { xdr: string; lastModifiedLedgerSeq: number }[];
}

export interface LocalCallResult {
  /** The call, decoded exactly as an RPC `simulateTransaction` response would be. */
  report: SimulationReport;
  /** CPU instructions metered, before RPC's safety margin. */
  cpuInstructions: number;
  /** Memory bytes metered. */
  memoryBytes: number;
  /** Whether the call's writes were applied to the local ledger. */
  committed: boolean;
}

export interface DeployedLocalContract {
  contractId: string;
  wasmHash: string;
}

export interface SwapResult {
  contractId: string;
  oldWasmHash: string;
  newWasmHash: string;
}

/** The shape of the native module (packages/dev/engine). */
interface NativeEngine {
  readonly sourceAccount: string;
  readonly sequence: number;
  readonly protocol: number;
  readonly entryCount: number;
  advance(ledgers: number, secondsPerLedger?: number): void;
  uploadWasm(wasm: Buffer): string;
  deploy(wasm: Buffer, constructorArgs?: string[]): DeployedLocalContract;
  invoke(contractId: string, fn: string, args: string[], commit?: boolean): string;
  swapWasm(contractId: string, wasm: Buffer): SwapResult;
}
type NativeEngineCtor = new (options: {
  networkPassphrase: string;
  protocolVersion: number;
  sequence: number;
  timestamp: number;
  configEntries: { xdr: string; lastModifiedLedgerSeq: number }[];
}) => NativeEngine;

/** Thrown when the native engine has not been built for this platform. */
export class EngineNotBuiltError extends Error {
  constructor(readonly searched: string[]) {
    super(
      `The @soroscope/dev engine binary was not found. Install the prebuilt package for your platform (it is an optional dependency of @soroscope/dev), build it with \`pnpm --filter @soroscope/dev build:engine\` (needs Rust), or set SOROSCOPE_ENGINE_PATH. Looked in:\n  ${searched.join('\n  ')}`,
    );
    this.name = 'EngineNotBuiltError';
  }
}

function nativeFileName(): string {
  if (process.platform === 'darwin') return 'libsoroscope_engine.dylib';
  if (process.platform === 'win32') return 'soroscope_engine.dll';
  return 'libsoroscope_engine.so';
}

/**
 * Where the prebuilt engine for this machine lives, if its package is
 * installed. `undefined` when none is published for this platform, or the
 * optional dependency was not installed (for example `--no-optional`).
 */
function installedEnginePath(): string | undefined {
  const pkg = enginePackageFor({ platform: process.platform, arch: process.arch, libc: detectLibc() });
  if (pkg === undefined) return undefined;
  try {
    return createRequire(import.meta.url).resolve(`${pkg}/${ENGINE_BINARY}`);
  } catch {
    return undefined;
  }
}

/** What the native module exports. */
interface NativeModule {
  Engine: NativeEngineCtor;
  supportedProtocols: () => number[];
  hostProtocolVersion: () => number;
}

/**
 * Thrown when the network to emulate runs a protocol this build does not embed
 * a `soroban-env-host` for. A host only runs the protocol it was released for
 * (a newer network's contracts are refused, and an older network's cost model
 * lacks entries the host needs), so the engine links one host per protocol it
 * supports and refuses any other rather than guess.
 */
export class UnsupportedProtocolError extends Error {
  constructor(
    readonly networkProtocol: number,
    readonly supportedProtocols: readonly number[],
  ) {
    super(
      `The network runs protocol ${networkProtocol}, but this build of @soroscope/dev embeds a soroban-env-host only for protocol${supportedProtocols.length === 1 ? '' : 's'} ${supportedProtocols.join(' and ')}. ${
        networkProtocol > Math.max(...supportedProtocols) ? 'Update @soroscope/dev.' : 'Use a network on a supported protocol.'
      }`,
    );
    this.name = 'UnsupportedProtocolError';
  }
}

let cachedModule: NativeModule | undefined;

function loadNativeModule(): NativeModule {
  if (cachedModule !== undefined) return cachedModule;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.SOROSCOPE_ENGINE_PATH,
    // A local build wins over an installed package, so working on the engine just works.
    // From src/ (tests) and from dist/ (built package), the crate is one level up.
    resolve(here, '../engine/target/release', nativeFileName()),
    installedEnginePath(),
  ].filter((p): p is string => p !== undefined && p !== '');
  const found = candidates.find((p) => existsSync(p));
  if (found === undefined) throw new EngineNotBuiltError(candidates);
  // process.dlopen accepts any file name; require() would only for `.node`.
  const mod: { exports: Partial<NativeModule> } = { exports: {} };
  process.dlopen(mod, found);
  const { Engine, supportedProtocols, hostProtocolVersion } = mod.exports;
  if (Engine === undefined || supportedProtocols === undefined || hostProtocolVersion === undefined) {
    throw new Error(`${found} is not the current Soroscope engine (missing Engine, supportedProtocols or hostProtocolVersion export)`);
  }
  cachedModule = { Engine, supportedProtocols, hostProtocolVersion };
  return cachedModule;
}

/** Load the native engine. Exposed so callers can fail early with a clear message. */
export function loadNativeEngine(): NativeEngineCtor {
  return loadNativeModule().Engine;
}

/** The newest protocol the engine can emulate. */
export function hostProtocolVersion(): number {
  return loadNativeModule().hostProtocolVersion();
}

/** Every protocol the engine can emulate, oldest first. */
export function supportedProtocols(): number[] {
  return loadNativeModule().supportedProtocols();
}

/**
 * A Soroban ledger that lives in this process. Contracts run inside
 * `soroban-env-host`, the same host the network runs, through the same code
 * path Stellar RPC's `simulateTransaction` uses. There is no network, no
 * Docker and no signing; auth is recorded, not enforced, as in simulation.
 */
export class LocalNetwork {
  private constructor(private readonly native: NativeEngine) {}

  /** Start an empty local ledger that meters and prices calls like the network `config` came from. */
  static create(config: NetworkConfigSnapshot, options: { timestamp?: number } = {}): LocalNetwork {
    const { Engine, supportedProtocols: supported } = loadNativeModule();
    const protocols = supported();
    if (!protocols.includes(config.protocolVersion)) throw new UnsupportedProtocolError(config.protocolVersion, protocols);
    return new LocalNetwork(
      new Engine({
        networkPassphrase: config.networkPassphrase,
        protocolVersion: config.protocolVersion,
        sequence: config.latestLedger,
        timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
        configEntries: config.configEntries,
      }),
    );
  }

  /** The protocol this local ledger emulates. */
  get protocol(): number {
    return this.native.protocol;
  }

  /** `G...` address of the local account that deploys and invokes. It never signs anything. */
  get sourceAccount(): string {
    return this.native.sourceAccount;
  }

  get sequence(): number {
    return this.native.sequence;
  }

  /** Close `ledgers` empty ledgers. TTLs and timestamps seen by contracts move with it. */
  advance(ledgers: number, secondsPerLedger = 5): void {
    this.native.advance(ledgers, secondsPerLedger);
  }

  /** Upload `wasm` and create a contract from it. Constructor arguments are base64 `ScVal`s. */
  deploy(wasm: Uint8Array, constructorArgs: string[] = []): DeployedLocalContract {
    return this.native.deploy(Buffer.from(wasm), constructorArgs);
  }

  /**
   * Call `fn` with `args` (base64 `ScVal`s). By default a successful call's
   * writes are applied; pass `{ commit: false }` to only simulate.
   */
  invoke(contractId: string, fn: string, args: string[] = [], options: { commit?: boolean } = {}): LocalCallResult {
    const commit = options.commit ?? true;
    const raw = JSON.parse(this.native.invoke(contractId, fn, args, commit)) as RawSimulateResponse & {
      cpuInstructions: number;
      memoryBytes: number;
    };
    const report = decodeSimulationResponse(raw);
    return { report, cpuInstructions: raw.cpuInstructions, memoryBytes: raw.memoryBytes, committed: commit && report.ok };
  }

  /**
   * Hot swap: run `contractId` on new code, in place. Its ID, instance storage
   * and all its persistent and temporary entries are kept.
   */
  swapWasm(contractId: string, wasm: Uint8Array): SwapResult {
    return this.native.swapWasm(contractId, Buffer.from(wasm));
  }
}

/**
 * Read a live network's configuration, to start a {@link LocalNetwork} that
 * prices calls like it. One `getLedgerEntries` and one `getLatestLedger` call.
 */
export async function fetchNetworkConfig(rpc: RpcCaller, networkPassphrase: string): Promise<NetworkConfigSnapshot> {
  // LedgerKey::ConfigSetting: LedgerEntryType CONFIG_SETTING (8), then the
  // ConfigSettingId, both big-endian int32. Ids 0..16 cover protocol 29.
  const keys = Array.from({ length: 17 }, (_, id) => {
    const b = Buffer.alloc(8);
    b.writeInt32BE(8, 0);
    b.writeInt32BE(id, 4);
    return b.toString('base64');
  });
  const entries = await rpc.call<{ latestLedger: number; entries?: { xdr: string; lastModifiedLedgerSeq: number }[] }>(
    'getLedgerEntries',
    { keys },
  );
  const latest = await rpc.call<{ protocolVersion: number }>('getLatestLedger');
  return {
    networkPassphrase,
    protocolVersion: latest.protocolVersion,
    latestLedger: entries.latestLedger,
    configEntries: (entries.entries ?? []).map((e) => ({ xdr: e.xdr, lastModifiedLedgerSeq: e.lastModifiedLedgerSeq })),
  };
}
