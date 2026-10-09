/** Stellar RPC methods the router understands. Unknown methods are still routable. */
export type RpcMethod =
  | 'getHealth'
  | 'getNetwork'
  | 'getVersionInfo'
  | 'getFeeStats'
  | 'getLatestLedger'
  | 'getLedgerEntries'
  | 'getLedgers'
  | 'getTransaction'
  | 'getTransactions'
  | 'getEvents'
  | 'simulateTransaction'
  | 'sendTransaction';

/**
 * How far back a method can reach.
 * - `none`: no historical requirement.
 * - `window`: bound to the advertised retention window (`getHealth.oldestLedger`).
 * - `deep`: some providers serve it from a data lake far beyond the advertised
 *   window, so reach has to be probed rather than read from `getHealth`.
 */
export type HistoryKind = 'none' | 'window' | 'deep';

export interface MethodProfile {
  /** Light calls feed the light latency statistics, heavy calls the heavy ones. */
  weight: 'light' | 'heavy';
  /** The method reads current state, so a provider that lags the network is a poor choice. */
  needsFresh: boolean;
  history: HistoryKind;
}

const PROFILES: Readonly<Record<RpcMethod, MethodProfile>> = {
  getHealth: { weight: 'light', needsFresh: false, history: 'none' },
  getNetwork: { weight: 'light', needsFresh: false, history: 'none' },
  getVersionInfo: { weight: 'light', needsFresh: false, history: 'none' },
  getFeeStats: { weight: 'light', needsFresh: false, history: 'none' },
  getLatestLedger: { weight: 'light', needsFresh: true, history: 'none' },
  getLedgerEntries: { weight: 'light', needsFresh: true, history: 'none' },
  getLedgers: { weight: 'heavy', needsFresh: false, history: 'deep' },
  getTransaction: { weight: 'light', needsFresh: false, history: 'none' },
  getTransactions: { weight: 'heavy', needsFresh: false, history: 'window' },
  getEvents: { weight: 'heavy', needsFresh: false, history: 'window' },
  simulateTransaction: { weight: 'heavy', needsFresh: true, history: 'none' },
  sendTransaction: { weight: 'light', needsFresh: true, history: 'none' },
};

const DEFAULT_PROFILE: MethodProfile = { weight: 'light', needsFresh: false, history: 'none' };

/** Profile for a method name; unknown methods get a neutral profile. */
export function profileOf(method: string): MethodProfile {
  return (PROFILES as Record<string, MethodProfile | undefined>)[method] ?? DEFAULT_PROFILE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A Stellar paging token is a TOID: the ledger sequence lives in the high 32 bits. */
function ledgerOfCursor(cursor: string): number | undefined {
  const digits = /^(\d{1,19})/.exec(cursor)?.[1];
  if (digits === undefined) return undefined;
  try {
    return Number(BigInt(digits) >> 32n);
  } catch {
    return undefined;
  }
}

/**
 * The oldest ledger a request needs, read from its params: `startLedger` when
 * present, otherwise the ledger encoded in a pagination cursor.
 */
export function startLedgerOf(method: string, params: unknown): number | undefined {
  if (profileOf(method).history === 'none' || !isRecord(params)) return undefined;
  const start = params['startLedger'];
  if (typeof start === 'number' && Number.isInteger(start)) return start;
  const pagination = params['pagination'];
  if (isRecord(pagination)) {
    const cursor = pagination['cursor'];
    if (typeof cursor === 'string') return ledgerOfCursor(cursor);
  }
  return undefined;
}

/** Ledger bounds a response reports about the serving node. */
export interface LedgerObservation {
  latest?: number;
  oldest?: number;
}

/**
 * Read the ledger bounds out of a successful response. Almost every Stellar
 * RPC method reports `latestLedger`; the history methods also report
 * `oldestLedger`. Returns undefined when the result carries neither.
 */
export function ledgerObservationOf(result: unknown): LedgerObservation | undefined {
  if (!isRecord(result)) return undefined;
  const obs: LedgerObservation = {};
  const latest = result['latestLedger'] ?? result['sequence'];
  const oldest = result['oldestLedger'];
  if (typeof latest === 'number') obs.latest = latest;
  if (typeof oldest === 'number') obs.oldest = oldest;
  return obs.latest === undefined && obs.oldest === undefined ? undefined : obs;
}
