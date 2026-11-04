/**
 * Maturity of this package. `preview`: the in-process engine, the watch loop
 * (rebuild and hot swap) and spec-typed calls work and are tested; the
 * `soroscope dev` REPL is new.
 */
export const status = 'preview' as const;

export {
  LocalNetwork,
  EngineNotBuiltError,
  UnsupportedProtocolError,
  fetchNetworkConfig,
  hostProtocolVersion,
  loadNativeEngine,
} from './engine';
export type { NetworkConfigSnapshot, LocalCallResult, DeployedLocalContract, SwapResult } from './engine';

export { DevSession } from './session';
export type { ReloadResult, CallOutcome } from './session';

export { ContractInterface, NoEmbeddedSpecError, diffInterfaces, signature, typeName } from './spec';
export type { NamedEvent, InterfaceDiff } from './spec';

export { DevLoop } from './loop';
export type { DevLoopEvent, DevLoopOptions } from './loop';

export { BuildError, buildContract, hasStellarCli, resolveProject } from './build';
export type { Builder, BuildResult, ContractProject } from './build';
