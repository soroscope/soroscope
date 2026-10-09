import type {
  SpecEntry,
  SpecEnum,
  SpecEvent,
  SpecFunction,
  SpecStruct,
  SpecUnion,
} from './entries';
import type { ContractMeta } from './wasm';

/** Where a contract's code comes from. */
export type ContractSource =
  | { kind: 'wasm'; wasmHash: string }
  | { kind: 'stellarAsset' }
  | { kind: 'unknown' };

/** One named error code a contract can return. */
export interface ContractErrorInfo {
  code: number;
  name: string;
  doc: string;
  /** The error enum the code belongs to, e.g. `TokenError`. */
  enumName: string;
}

/**
 * What a contract says about itself: its functions, types, events and error
 * codes. Built from the spec embedded in the contract's WASM.
 */
export class ContractSpec {
  readonly functions: readonly SpecFunction[];
  readonly structs: readonly SpecStruct[];
  readonly unions: readonly SpecUnion[];
  readonly enums: readonly SpecEnum[];
  readonly events: readonly SpecEvent[];
  readonly errors: readonly ContractErrorInfo[];

  constructor(
    readonly entries: readonly SpecEntry[],
    readonly source: ContractSource = { kind: 'unknown' },
    readonly meta: ContractMeta = {},
  ) {
    this.functions = entries.filter((e): e is SpecFunction => e.kind === 'function');
    this.structs = entries.filter((e): e is SpecStruct => e.kind === 'struct');
    this.unions = entries.filter((e): e is SpecUnion => e.kind === 'union');
    this.enums = entries.filter((e): e is SpecEnum => e.kind === 'enum');
    this.events = entries.filter((e): e is SpecEvent => e.kind === 'event');
    this.errors = entries.flatMap((e) =>
      e.kind === 'errorEnum'
        ? e.cases.map((c) => ({ code: c.value, name: c.name, doc: c.doc, enumName: e.name }))
        : [],
    );
  }

  /** The function with this name, if the contract declares it. */
  function(name: string): SpecFunction | undefined {
    return this.functions.find((f) => f.name === name);
  }

  /**
   * Every error the contract declares with this code. Normally one; a contract
   * may reuse a number across enums, so callers should treat more than one as ambiguous.
   */
  lookupErrors(code: number): ContractErrorInfo[] {
    return this.errors.filter((e) => e.code === code);
  }

  /** The error with this code, or undefined when none (or only an ambiguous set) matches. */
  lookupError(code: number): ContractErrorInfo | undefined {
    const matches = this.lookupErrors(code);
    return matches.length === 1 ? matches[0] : undefined;
  }

  /** A spec for a contract with no WASM spec (the built-in Stellar Asset Contract). */
  static empty(source: ContractSource): ContractSpec {
    return new ContractSpec([], source);
  }
}
