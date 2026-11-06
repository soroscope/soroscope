import { createHash } from 'node:crypto';
import { describeSimulation, scValToJs, type SimulationReport } from '@soroscope/core';
import { LocalNetwork, type NetworkConfigSnapshot } from './engine';
import { ContractInterface, diffInterfaces, type InterfaceDiff, type NamedEvent } from './spec';

export interface ReloadResult {
  /** `deployed` the first time, `swapped` when the code changed, `unchanged` when the WASM is byte-identical. */
  kind: 'deployed' | 'swapped' | 'unchanged';
  contractId: string;
  wasmHash: string;
  diff: InterfaceDiff;
}

export interface CallOutcome {
  report: SimulationReport;
  /** The return value as plain JSON-safe data (64-bit+ integers as strings); null if it failed or returned nothing. */
  value: unknown;
  /** Contract events the call emitted, named from the spec where it declares them. */
  events: (NamedEvent | { name: null; topics: unknown[]; data: unknown })[];
  cpuInstructions: number;
  memoryBytes: number;
  committed: boolean;
  /** One-line human summary. */
  summary: string;
  /** For a contract error: its name and doc comment from the contract's `#[contracterror]` enum. */
  errorCase: { code: number; name: string; doc: string } | null;
}

/**
 * One contract under development, running in a {@link LocalNetwork}. Load a
 * build with {@link reload}: the first deploys it, later ones hot-swap the code
 * in place so storage survives. Call functions by name with named arguments
 * typed by the contract's own spec.
 */
export class DevSession {
  private current: { contractId: string; wasmHash: string; iface: ContractInterface } | null = null;
  /** Companion contracts deployed beside the one under development, by name. */
  private readonly companions = new Map<string, { contractId: string; wasmHash: string; iface: ContractInterface }>();

  constructor(readonly network: LocalNetwork) {}

  static create(config: NetworkConfigSnapshot, options: { timestamp?: number } = {}): DevSession {
    return new DevSession(LocalNetwork.create(config, options));
  }

  /** The contract's ID, once a build is loaded. */
  get contractId(): string | null {
    return this.current?.contractId ?? null;
  }

  get interface(): ContractInterface | null {
    return this.current?.iface ?? null;
  }

  /**
   * Deploy another contract beside the one under development, so a contract
   * that calls another can be run and tested together. Companions are not
   * rebuilt on save; call them with `call(fn, args, { contract: name })`.
   * @throws {Error} If `name` is already taken.
   */
  addContract(name: string, wasm: Uint8Array, constructorArgs: Record<string, unknown> = {}): { contractId: string; interface: ContractInterface } {
    if (this.companions.has(name)) throw new Error(`A contract named "${name}" is already in this session.`);
    const iface = ContractInterface.fromWasm(wasm);
    const wasmHash = createHash('sha256').update(wasm).digest('hex');
    const ctorArgs = iface.function('__constructor') === undefined ? [] : iface.encodeArgs('__constructor', constructorArgs);
    const { contractId } = this.network.deploy(wasm, ctorArgs);
    this.companions.set(name, { contractId, wasmHash, iface });
    return { contractId, interface: iface };
  }

  /** Companion contracts by name, with their addresses. */
  get contracts(): { name: string; contractId: string }[] {
    return [...this.companions].map(([name, c]) => ({ name, contractId: c.contractId }));
  }

  /** The spec of a companion contract. */
  interfaceOf(name: string): ContractInterface | null {
    return this.companions.get(name)?.iface ?? null;
  }

  /**
   * Load a build. Constructor arguments (named, typed by the spec's
   * `__constructor`) are used only on the first deploy.
   */
  reload(wasm: Uint8Array, constructorArgs: Record<string, unknown> = {}): ReloadResult {
    const iface = ContractInterface.fromWasm(wasm);
    const wasmHash = createHash('sha256').update(wasm).digest('hex');
    const before = this.current;
    if (before === null) {
      const ctorArgs = iface.function('__constructor') === undefined ? [] : iface.encodeArgs('__constructor', constructorArgs);
      const { contractId } = this.network.deploy(wasm, ctorArgs);
      this.current = { contractId, wasmHash, iface };
      return { kind: 'deployed', contractId, wasmHash, diff: diffInterfaces(null, iface) };
    }
    if (before.wasmHash === wasmHash) {
      return { kind: 'unchanged', contractId: before.contractId, wasmHash, diff: { added: [], removed: [], changed: [] } };
    }
    this.network.swapWasm(before.contractId, wasm);
    this.current = { contractId: before.contractId, wasmHash, iface };
    return { kind: 'swapped', contractId: before.contractId, wasmHash, diff: diffInterfaces(before.iface, iface) };
  }

  /**
   * Call `fn` with named arguments. The string `"me"` stands for the local
   * source account wherever an address is expected.
   * @throws {Error} If no build is loaded, or the arguments do not fit the spec.
   */
  call(fn: string, args: Record<string, unknown> = {}, options: { commit?: boolean; contract?: string } = {}): CallOutcome {
    let target = this.current;
    if (options.contract !== undefined) {
      target = this.companions.get(options.contract) ?? null;
      if (target === null) {
        const known = [...this.companions.keys()];
        throw new Error(`No contract named "${options.contract}" in this session${known.length === 0 ? '' : ` (have: ${known.join(', ')})`}.`);
      }
    }
    if (target === null) throw new Error('No contract loaded yet.');
    const { iface, contractId } = target;
    const spec = iface.function(fn);
    const resolved = Object.fromEntries(
      Object.entries(args).map(([k, v]) => {
        const p = spec?.params.find((x) => x.name === k);
        return [k, v === 'me' && p?.type === 'address' ? this.network.sourceAccount : v];
      }),
    );
    const encoded = iface.encodeArgs(fn, resolved);
    const r = this.network.invoke(contractId, fn, encoded, options.commit === undefined ? {} : { commit: options.commit });
    const events = r.report.events
      .filter((e) => e.event.type === 'contract' && e.inSuccessfulContractCall)
      .map((e) => iface.nameEvent(e.event) ?? { name: null, topics: e.event.topics.map(scValToJs), data: scValToJs(e.event.data) });
    const code = r.report.failure?.error.contractCode ?? null;
    const named = code === null ? null : iface.errorCase(code);
    return {
      errorCase: code === null || named === null ? null : { code, ...named },
      report: r.report,
      value: r.report.returnValue === null ? null : scValToJs(r.report.returnValue),
      events,
      cpuInstructions: r.cpuInstructions,
      memoryBytes: r.memoryBytes,
      committed: r.committed,
      summary: describeSimulation(r.report),
    };
  }
}
