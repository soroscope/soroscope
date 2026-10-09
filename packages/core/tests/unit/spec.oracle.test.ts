import { describe, expect, it } from 'vitest';
import {
  ContractSpec,
  XdrDecodeError,
  contractCodeKey,
  contractInstanceKey,
  decodeLedgerEntryData,
  decodeContractId,
  encodeContractId,
  parseWasm,
} from '../../src';
import { specEntryOracle } from '../helpers/oracle';
import { soroban } from '../helpers/soroban';

// Real compiled contracts from the live Stellar testnet. Expected values come from
// `stellar contract info interface|meta` run on the same WASM bytes.
const contracts = soroban.contracts;

describe('fixture sanity', () => {
  it('captured real contracts with an oracle reading', () => {
    expect(contracts.length).toBeGreaterThan(0);
    for (const c of contracts) {
      expect(c.oracleSpec).not.toBeNull();
      expect(c.oracleMeta).not.toBeNull();
    }
  });
});

describe.each(contracts.map((c) => [c.contractId.slice(0, 8), c] as const))('contract %s', (_n, c) => {
  const wasm = Uint8Array.from(Buffer.from(c.wasmBase64, 'base64'));
  const parsed = parseWasm(wasm);

  it('spec matches the stellar CLI entry for entry', () => {
    expect(parsed.spec.map(specEntryOracle)).toEqual(c.oracleSpec);
  });

  it('metadata matches the stellar CLI', () => {
    const expected = Object.fromEntries(c.oracleMeta!.map((m) => [m.sc_meta_v0.key, m.sc_meta_v0.val]));
    expect(parsed.meta).toEqual(expected);
  });

  it('finds the contract sections', () => {
    expect(parsed.customSections).toContain('contractspecv0');
  });

  it('builds the same ledger keys the stellar CLI does', () => {
    expect(contractInstanceKey(c.contractId)).toBe(c.instanceKey);
    expect(contractCodeKey(c.wasmHash)).toBe(c.codeKey);
  });

  it('the on-ledger instance points at this WASM', () => {
    const entry = decodeLedgerEntryData(c.instanceEntryXdr);
    expect(entry.type).toBe('contractData');
    if (entry.type !== 'contractData' || entry.val.type !== 'contractInstance') throw new Error('not an instance');
    expect(entry.val.executable).toEqual({ type: 'wasm', wasmHash: c.wasmHash });
  });

  it('the on-ledger code entry holds exactly this WASM', () => {
    const entry = decodeLedgerEntryData(c.codeEntryXdr);
    if (entry.type !== 'contractCode') throw new Error('not a code entry');
    expect(Buffer.from(entry.code).equals(Buffer.from(wasm))).toBe(true);
    expect(entry.hash).toBe(c.wasmHash);
  });

  it('round-trips the contract id through strkey decode/encode', () => {
    expect(encodeContractId(decodeContractId(c.contractId))).toBe(c.contractId);
  });
});

describe('ContractSpec', () => {
  const withErrors = contracts.find((c) => parseWasm(Buffer.from(c.wasmBase64, 'base64')).spec.some((e) => e.kind === 'errorEnum'));

  it('resolves declared error codes to names', () => {
    expect(withErrors, 'no captured contract declares an error enum').toBeDefined();
    const parsed = parseWasm(Buffer.from(withErrors!.wasmBase64, 'base64'));
    const spec = new ContractSpec(parsed.spec, { kind: 'wasm', wasmHash: withErrors!.wasmHash });
    const declared = parsed.spec.flatMap((e) => (e.kind === 'errorEnum' ? e.cases.map((c) => ({ ...c, enumName: e.name })) : []));
    expect(spec.errors).toHaveLength(declared.length);
    for (const d of declared) {
      const found = spec.lookupErrors(d.value);
      expect(found.some((f) => f.name === d.name && f.enumName === d.enumName)).toBe(true);
    }
    expect(spec.lookupError(4_000_000_000)).toBeUndefined();
  });

  it('exposes functions by name', () => {
    const c = contracts[0]!;
    const parsed = parseWasm(Buffer.from(c.wasmBase64, 'base64'));
    const spec = new ContractSpec(parsed.spec);
    const first = parsed.spec.find((e) => e.kind === 'function');
    expect(spec.function(first!.name as string)).toBe(first);
    expect(spec.function('definitely_not_a_function')).toBeUndefined();
  });
});

describe('WASM parsing rejects bad input', () => {
  it('bytes that are not WebAssembly', () => {
    expect(() => parseWasm(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(XdrDecodeError);
  });

  it('a real module cut short', () => {
    const wasm = Buffer.from(contracts[0]!.wasmBase64, 'base64');
    expect(() => parseWasm(wasm.subarray(0, wasm.length - 100))).toThrow(XdrDecodeError);
  });

  it('a real module with a corrupt checksum on its contract id', () => {
    const id = contracts[0]!.contractId;
    const bad = id.slice(0, -1) + (id.endsWith('A') ? 'B' : 'A');
    expect(() => decodeContractId(bad)).toThrow(/checksum|canonical/);
  });
});
