import { describe, expect, it } from 'vitest';
import {
  ContractSpec,
  decodeSimulationResponse,
  describeSimulation,
  findFailure,
  formatScVal,
  parseWasm,
  resolveContractError,
  scValToJs,
} from '../../src';
import type { RawSimulateResponse } from '../../src';
import { soroban } from '../helpers/soroban';

// Responses below are what live Stellar testnet RPC returned for simulateTransaction
// calls against the native-asset contract. See packages/test-utils/scripts/record-soroban.mjs.
const sim = (name: string): RawSimulateResponse => {
  const s = soroban.simulations.find((x) => x.name.startsWith(name));
  if (s === undefined) throw new Error(`no recorded simulation "${name}"`);
  return s.response as unknown as RawSimulateResponse;
};
const NATIVE = soroban.provenance.nativeAssetContract;
const OTHER = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';

describe('successful read-only simulation', () => {
  const report = decodeSimulationResponse(sim('name'));

  it('decodes the return value', () => {
    expect(report.ok).toBe(true);
    expect(report.returnValue).toMatchObject({ type: 'string', value: 'native' });
    expect(scValToJs(report.returnValue!)).toBe('native');
  });

  it('reports resources and fee from the transaction data', () => {
    expect(report.transactionData!.resources.instructions).toBeGreaterThan(0);
    expect(report.minResourceFee).toBeGreaterThan(0n);
    expect(report.transactionData!.resources.footprint.readWrite).toHaveLength(0);
  });

  it('keeps the diagnostic events', () => {
    expect(report.events.length).toBeGreaterThan(0);
    expect(report.failure).toBeNull();
  });

  it('describes itself', () => {
    const text = describeSimulation(report);
    expect(text).toMatch(/^Simulation succeeded/);
    expect(text).toContain('"native"');
  });
});

describe('typed return values', () => {
  it('u32', () => {
    expect(decodeSimulationResponse(sim('decimals')).returnValue).toEqual({ type: 'u32', value: 7 });
  });

  it('i128 comes back as a bigint', () => {
    const v = decodeSimulationResponse(sim('balance')).returnValue!;
    expect(v.type).toBe('i128');
    expect(typeof (v as { value: bigint }).value).toBe('bigint');
    expect(formatScVal(v)).toMatch(/^i128\(\d+\)$/);
  });
});

describe('simulation that needs authorization', () => {
  const report = decodeSimulationResponse(sim('transfer needing auth'));

  it('lists who must sign, and for which call', () => {
    expect(report.auth).toHaveLength(1);
    const entry = report.auth[0]!;
    expect(entry.credentials).toMatchObject({ type: 'address', address: { address: OTHER } });
    expect(entry.rootInvocation.function).toMatchObject({
      type: 'contractFn',
      functionName: 'transfer',
      contract: { address: NATIVE },
    });
  });

  it('predicts which ledger entries change', () => {
    expect(report.stateChanges.length).toBeGreaterThan(0);
    expect(report.stateChanges.every((c) => c.key.type.length > 0)).toBe(true);
    expect(report.transactionData!.resources.footprint.readWrite.length).toBeGreaterThan(0);
    expect(describeSimulation(report)).toMatch(/Needs 1 authorization/);
  });
});

describe('failing simulation', () => {
  const raw = sim('transfer exceeding');
  const report = decodeSimulationResponse(raw);

  it('is a failure that names the contract and error code', () => {
    expect(report.ok).toBe(false);
    expect(report.error).toContain('Error(Contract, #10)');
    expect(report.failure).not.toBeNull();
    expect(report.failure!.contractId).toBe(NATIVE);
    expect(report.failure!.error.contractCode).toBe(10);
  });

  it('carries the contract message and the values it reported', () => {
    expect(report.failure!.message).toBe('resulting balance is not within the allowed range');
    expect(report.failure!.details.length).toBeGreaterThan(0);
  });

  it('is summarised in one sentence', () => {
    const text = describeSimulation(report);
    expect(text).toContain(NATIVE);
    expect(text).toContain('Error(Contract, #10)');
    expect(text).toContain('resulting balance is not within the allowed range');
  });

  it('finds the same failure from the events alone', () => {
    expect(findFailure(report.events)?.error.contractCode).toBe(10);
  });

  it('the native asset contract has no WASM spec, so the code stays unnamed', () => {
    const resolved = resolveContractError(report.failure!, ContractSpec.empty({ kind: 'stellarAsset' }));
    expect(resolved.errorName).toBeNull();
    expect(resolved.message).toBe('resulting balance is not within the allowed range');
  });
});

describe('resolveContractError with a real contract spec', () => {
  it('names a code the spec declares, and flags ambiguous codes', () => {
    const base = decodeSimulationResponse(sim('transfer exceeding')).failure!;
    const withErrors = soroban.contracts.find((c) =>
      (c.oracleSpec ?? []).some((e) => 'udt_error_enum_v0' in (e as object)),
    )!;
    // Build the spec from the real contract's decoded entries.
    const parsed = { ContractSpec, parseWasm };
    const spec = new parsed.ContractSpec(
      parsed.parseWasm(Buffer.from(withErrors.wasmBase64, 'base64')).spec,
      { kind: 'wasm', wasmHash: withErrors.wasmHash },
    );
    const declared = spec.errors[0]!;
    // The failure's identity (code) is swapped for one this real spec declares: the function
    // under test is the pure mapping from (code, spec) to a name.
    const failure = { ...base, error: { ...base.error, contractCode: declared.code } };
    const resolved = resolveContractError(failure, spec);
    if (spec.lookupErrors(declared.code).length === 1) {
      expect(resolved.errorName).toBe(declared.name);
      expect(resolved.errorEnum).toBe(declared.enumName);
    } else {
      expect(resolved.ambiguous).toBe(true);
      expect(resolved.errorName).toBeNull();
    }
  });

  it('leaves host errors alone', () => {
    const base = decodeSimulationResponse(sim('transfer exceeding')).failure!;
    const host = { ...base, error: { ...base.error, isContractError: false, contractCode: null } };
    const empty = new ContractSpec([], { kind: 'unknown' });
    expect(resolveContractError(host, empty)).toBe(host);
  });
});
