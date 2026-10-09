import { readFileSync } from 'node:fs';
import {
  decodeAuthEntry,
  decodeContractEvent,
  decodeDiagnosticEvent,
  decodeLedgerEntryData,
  decodeLedgerKey,
  decodeScError,
  decodeScVal,
  decodeSorobanTransactionData,
  decodeSpecEntries,
  decodeTransactionResult,
  explainTransactionError,
  scValToJs,
  toJsonSafe,
} from '@soroscope/core';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';

type Decoder = (input: string) => unknown;

/** Every XDR type `soroscope decode` understands. */
export const DECODERS: Readonly<Record<string, Decoder>> = {
  ScVal: decodeScVal,
  ScError: decodeScError,
  ContractEvent: decodeContractEvent,
  DiagnosticEvent: decodeDiagnosticEvent,
  SorobanAuthorizationEntry: decodeAuthEntry,
  SorobanTransactionData: decodeSorobanTransactionData,
  LedgerKey: decodeLedgerKey,
  LedgerEntryData: decodeLedgerEntryData,
  TransactionResult: decodeTransactionResult,
  ScSpecEntries: decodeSpecEntries,
};

export interface DecodeOptions {
  /** Print ScVal as plain JavaScript instead of the tagged tree. */
  plain?: boolean;
}

function readInput(arg: string): string {
  if (arg !== '-') return arg.trim();
  return readFileSync(0, 'utf8').trim();
}

export function runDecode(type: string, input: string, opts: DecodeOptions, io: Io): ExitCodeValue {
  const decode = DECODERS[type];
  if (decode === undefined) {
    throw new CliError(`Unknown type "${type}". Known types: ${Object.keys(DECODERS).join(', ')}.`, ExitCode.Usage);
  }
  const text = readInput(input);
  if (text === '') throw new CliError('No XDR given. Pass base64, or - to read standard input.', ExitCode.Usage);
  let value: unknown;
  try {
    value = decode(text);
  } catch (err) {
    throw new CliError(`Cannot decode as ${type}: ${err instanceof Error ? err.message : String(err)}`, ExitCode.Failure);
  }
  const shown = opts.plain === true && type === 'ScVal' ? scValToJs(value as Parameters<typeof scValToJs>[0]) : toJsonSafe(value);
  io.out(JSON.stringify(shown, null, 2));
  return ExitCode.Ok;
}

/** One-line explanation of a transaction result or error value. */
export function runExplain(input: string, io: Io): ExitCodeValue {
  const text = readInput(input);
  try {
    io.out(explainTransactionError(text));
  } catch (err) {
    throw new CliError(`Cannot explain: ${err instanceof Error ? err.message : String(err)}`, ExitCode.Failure);
  }
  return ExitCode.Ok;
}
