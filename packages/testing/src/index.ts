/**
 * Maturity of this package. `preview`: calls can be recorded against a live
 * network (its own simulation plus the exact state the call touches) and replayed
 * on the in-process engine, offline, with the result compared to the network's.
 * Forking at an arbitrary past ledger and writing state back are not built.
 */
export const status = 'preview' as const;

export { forkAndCompare, recordFork, replayFork } from './fork';
export type { ForkCall, ForkCallRecording, ForkOptions, ForkRecording, ForkResult } from './fork';
