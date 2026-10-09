import type { DiagnosticEvent } from '../decode/events';
import type { DecodedScError } from '../decode/types';
import type { ScVal } from '../decode/scval';
import { formatScVal } from '../decode/scval';
import type { ContractSpec } from './ContractSpec';

/** The error a failed call raised, with names filled in from the contract's own spec. */
export interface ContractFailure {
  /** The contract that raised the error, when the event says. */
  contractId: string | null;
  error: DecodedScError;
  /** Human-readable text the contract attached (first string in the event data). */
  message: string | null;
  /** The rest of the event data: the values the contract reported alongside the error. */
  details: ScVal[];
  /** The error's name from the contract spec (e.g. `InsufficientBalance`), when known. */
  errorName: string | null;
  errorDoc: string | null;
  /** The spec's error enum this code belongs to. */
  errorEnum: string | null;
  /** True when more than one error enum in the spec uses this code. */
  ambiguous: boolean;
}

/**
 * Find the error in a list of diagnostic events. By convention a failing call
 * emits an event `[error, <Error value>]` from the contract that raised it,
 * with data `[message, ...details]`. Returns the first such event (the root cause).
 */
export function findFailure(events: readonly DiagnosticEvent[]): ContractFailure | null {
  for (const { event } of events) {
    const [name, value] = event.topics;
    if (name?.type !== 'symbol' || name.value !== 'error' || value?.type !== 'error') continue;
    const data = event.data;
    const items = data.type === 'vec' && data.value !== null ? data.value : [data];
    const first = items[0];
    return {
      contractId: event.contractId,
      error: value.error,
      message: first?.type === 'string' ? first.value : first === undefined ? null : formatScVal(first),
      details: first?.type === 'string' ? items.slice(1) : items,
      errorName: null,
      errorDoc: null,
      errorEnum: null,
      ambiguous: false,
    };
  }
  return null;
}

/** Fill a failure's error name from the contract's spec, when it declares that code. */
export function resolveContractError(failure: ContractFailure, spec: ContractSpec | undefined): ContractFailure {
  if (spec === undefined || !failure.error.isContractError || failure.error.contractCode === null) {
    return failure;
  }
  const matches = spec.lookupErrors(failure.error.contractCode);
  if (matches.length === 0) return failure;
  const first = matches[0]!;
  return {
    ...failure,
    errorName: matches.length === 1 ? first.name : null,
    errorDoc: matches.length === 1 && first.doc !== '' ? first.doc : null,
    errorEnum: matches.length === 1 ? first.enumName : null,
    ambiguous: matches.length > 1,
  };
}

/**
 * Pull the `Error(Type, Code)` out of a simulation error string. Use it only
 * when the diagnostic events are not available; the events carry more.
 */
export function parseErrorText(text: string): { type: string; code: string } | null {
  const match = /Error\((\w+),\s*#?(\w+)\)/.exec(text);
  return match?.[1] !== undefined && match[2] !== undefined ? { type: match[1], code: match[2] } : null;
}
