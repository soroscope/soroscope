// RPC transport
export { RpcClient } from './rpc/RpcClient';
export {
  RpcError,
  RpcNetworkError,
  RpcTimeoutError,
  RpcHttpError,
  RpcProtocolError,
  RpcResponseError,
  NoEligibleProviderError,
  AllProvidersFailedError,
  parseRetryAfter,
} from './rpc/errors';
export type { Attempt } from './rpc/errors';
export { classifyFailure, parseRetentionRange, HARD_FAILURES } from './rpc/classify';
export type { FailureClass, RetentionRange } from './rpc/classify';
export { profileOf, startLedgerOf, ledgerObservationOf } from './rpc/methods';
export type { RpcMethod, MethodProfile, HistoryKind, LedgerObservation } from './rpc/methods';
export type { RpcClientConfig, RpcCallOptions, RpcRawResult, RpcCaller } from './rpc/types';

// Routing
export { ProviderRegistry, providerIdOf, LEDGER_CLOSE_MS } from './routing/ProviderRegistry';
export type {
  ProviderInput,
  ProviderRecord,
  ProviderStatus,
  LatencyStat,
  RegistryConfig,
  RegistrySnapshot,
  RoutingRequirements,
  Exclusion,
} from './routing/ProviderRegistry';
export { SoroscopeRouter } from './routing/SoroscopeRouter';
export type {
  RouterConfig,
  RouterCallOptions,
  DetailedResult,
  PerProviderResult,
  RouteExplanation,
} from './routing/SoroscopeRouter';
export {
  PUBLIC_PROVIDERS,
  NETWORK_PASSPHRASES,
  publicProviderUrls,
} from './routing/catalog';
export type { NetworkId, CatalogEntry } from './routing/catalog';

// Probing
export { probeProviders } from './probe/probe';
export type {
  ProbeOptions,
  ProbeReport,
  ProviderProbe,
  LatencySummary,
  BurstResult,
} from './probe/probe';
export { toJson, toPrometheus, toTable, toTableRows } from './probe/format';
export type { TableRow } from './probe/format';

// Decoding
export * from './decode';
export {
  encodeAccountId,
  encodeContractId,
  decodeAccountId,
  decodeContractId,
  decodeStrkey,
  fromHex,
  toHex,
} from './xdr/strkey';

export { base64ToBytes, bytesToBase64 } from './xdr/base64';

// Contract specs
export * from './spec';

// Simulation
export * from './simulation';
