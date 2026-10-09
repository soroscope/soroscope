import { Address, contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';

/** An argument with its Soroban type spelled out, for contracts that have no spec (the Stellar Asset Contract). */
export interface TypedArg {
  type:
    | 'bool' | 'u32' | 'i32' | 'u64' | 'i64' | 'u128' | 'i128' | 'u256' | 'i256'
    | 'string' | 'symbol' | 'address' | 'bytes' | 'timepoint' | 'duration';
  /** The value; integers wider than 32 bits are decimal strings, bytes are hex. */
  value: string | number | boolean;
}

/**
 * Arguments for a call. Three forms:
 * - a record keyed by parameter name (needs the contract's spec),
 * - an array of {@link TypedArg} (works without a spec),
 * - an array of ready `xdr.ScVal`.
 */
export type InvocationArgs = Record<string, unknown> | readonly (TypedArg | xdr.ScVal)[];

function isScVal(value: unknown): value is xdr.ScVal {
  return typeof value === 'object' && value !== null && value instanceof xdr.ScVal;
}

function isTypedArg(value: unknown): value is TypedArg {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value &&
    typeof (value as { type: unknown }).type === 'string'
  );
}

function typedToScVal(arg: TypedArg): xdr.ScVal {
  switch (arg.type) {
    case 'address':
      return new Address(String(arg.value)).toScVal();
    case 'bytes':
      return nativeToScVal(Buffer.from(String(arg.value), 'hex'), { type: 'bytes' });
    case 'bool':
      return xdr.ScVal.scvBool(Boolean(arg.value));
    case 'u32':
    case 'i32':
      return nativeToScVal(Number(arg.value), { type: arg.type });
    default:
      return nativeToScVal(typeof arg.value === 'number' ? BigInt(arg.value) : String(arg.value), {
        type: arg.type,
      });
  }
}

/**
 * Convert call arguments into `ScVal`s.
 * @param spec - The contract's spec; required for named (record) arguments.
 * @throws {TypeError} If named arguments are given without a spec, or an argument is malformed.
 */
export function toScVals(
  functionName: string,
  args: InvocationArgs | undefined,
  spec: contract.Spec | null,
): xdr.ScVal[] {
  if (args === undefined) return [];
  if (Array.isArray(args)) {
    return (args as readonly unknown[]).map((a, i) => {
      if (isScVal(a)) return a;
      if (isTypedArg(a)) return typedToScVal(a);
      throw new TypeError(
        `Argument ${i} of ${functionName} must be an xdr.ScVal or {type, value}; named arguments belong in an object.`,
      );
    });
  }
  if (spec === null) {
    throw new TypeError(
      `${functionName}: named arguments need the contract's spec, and this contract has none (it is a Stellar Asset Contract). Pass a list of {type, value} instead.`,
    );
  }
  try {
    spec.getFunc(functionName);
  } catch {
    // The SDK throws for unknown names; say it in our own words.
    throw new TypeError(`The contract has no function named "${functionName}".`);
  }
  return spec.funcArgsToScVals(functionName, args as Record<string, unknown>);
}
