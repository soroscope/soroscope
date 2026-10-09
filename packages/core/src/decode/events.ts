import { encodeContractId } from '../xdr/strkey';
import type { XdrReader } from '../xdr/reader';
import { XdrUnsupportedError, decodeWith, readArray, readOptional } from './primitives';
import { readScVal } from './scval';
import type { ScVal } from './scval';

export type ContractEventType = 'system' | 'contract' | 'diagnostic';

/** A decoded `ContractEvent`. `contractId` is null for events not tied to a contract. */
export interface ContractEvent {
  type: ContractEventType;
  contractId: string | null;
  topics: ScVal[];
  data: ScVal;
}

/** A decoded `DiagnosticEvent`: an event plus whether its call frame succeeded. */
export interface DiagnosticEvent {
  inSuccessfulContractCall: boolean;
  event: ContractEvent;
}

export function readContractEvent(reader: XdrReader): ContractEvent {
  const extV = reader.readEnum();
  if (extV !== 0) throw new XdrUnsupportedError(`ExtensionPoint(${extV})`, reader.position);
  const contractId = readOptional(reader, () => encodeContractId(reader.readFixedOpaque(32)));
  const typeNum = reader.readEnum();
  const type: ContractEventType | undefined = (['system', 'contract', 'diagnostic'] as const)[typeNum];
  if (type === undefined) throw new XdrUnsupportedError(`ContractEventType(${typeNum})`, reader.position);
  const bodyV = reader.readEnum();
  if (bodyV !== 0) throw new XdrUnsupportedError(`ContractEventBody(${bodyV})`, reader.position);
  const topics = readArray(reader, () => readScVal(reader));
  const data = readScVal(reader);
  return { type, contractId, topics, data };
}

export function readDiagnosticEvent(reader: XdrReader): DiagnosticEvent {
  const inSuccessfulContractCall = reader.readBool();
  return { inSuccessfulContractCall, event: readContractEvent(reader) };
}

export function decodeContractEvent(input: string | Uint8Array): ContractEvent {
  return decodeWith('ContractEvent', input, readContractEvent);
}

export function decodeDiagnosticEvent(input: string | Uint8Array): DiagnosticEvent {
  return decodeWith('DiagnosticEvent', input, readDiagnosticEvent);
}

/**
 * The first symbol in an event's topics, which by convention names the event
 * (`transfer`, `fn_call`, `fn_return`, `error`…). Null if there is none.
 */
export function eventName(event: ContractEvent): string | null {
  const first = event.topics[0];
  return first !== undefined && first.type === 'symbol' ? first.value : null;
}
