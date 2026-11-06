import {
  compareSimulations,
  decodeSimulationResponse,
  type RawSimulateResponse,
  type RpcCaller,
  type SimulationDifference,
  type SimulationReport,
} from '@soroscope/core';
import {
  LocalNetwork,
  fetchNetworkConfig,
  type LiveLedgerEntry,
  type LocalCallResult,
  type NetworkConfigSnapshot,
} from '@soroscope/dev';
import { Account, Address, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';

/** A call to make against forked state. */
export interface ForkCall {
  contractId: string;
  fn: string;
  /** Arguments as base64 `ScVal`s. */
  args?: readonly string[];
}

/** What is needed to replay one call offline: the live answer and the exact state it was computed on. */
export interface ForkCallRecording extends Required<ForkCall> {
  /** Stellar RPC's own `simulateTransaction` response for the call. */
  live: RawSimulateResponse;
  /** Every ledger entry in the call's footprint, as `getLedgerEntries` returned it at the same ledger. */
  entries: LiveLedgerEntry[];
  /** Ledger the live simulation and the entries were read at. */
  ledger: number;
  /** Close time of that ledger, in Unix seconds. */
  closeTime: number;
}

/** A recording of calls against a live network: enough to replay them with no network. */
export interface ForkRecording {
  networkPassphrase: string;
  protocolVersion: number;
  /** The account the calls ran as. */
  source: string;
  configEntries: NetworkConfigSnapshot['configEntries'];
  calls: ForkCallRecording[];
}

export interface ForkResult {
  call: ForkCall;
  /** Stellar RPC's answer, decoded. */
  live: SimulationReport;
  /** The in-process engine's answer, on the same state. */
  local: LocalCallResult;
  /** Fields the two disagree on. Empty when the engine reproduced the network exactly. */
  differences: SimulationDifference[];
}

export interface ForkOptions {
  /** RPC endpoint or router to read from. */
  rpc: RpcCaller;
  networkPassphrase: string;
  /** `G...` account to run the calls as. It must exist on the network. */
  source: string;
}

const MAX_ATTEMPTS = 6;

function envelope(call: ForkCall, source: string, networkPassphrase: string): string {
  const tx = new TransactionBuilder(new Account(source, '0'), { fee: '100', networkPassphrase })
    .addOperation(
      Operation.invokeContractFunction({
        contract: new Address(call.contractId).toString(),
        function: call.fn,
        args: (call.args ?? []).map((a) => xdr.ScVal.fromXDR(a, 'base64')),
      }),
    )
    .setTimeout(0)
    .build();
  return tx.toXDR();
}

/** The ledger keys a simulation says a call reads and writes, as base64 `LedgerKey`s. */
function footprintKeys(transactionData: string): string[] {
  const { footprint } = xdr.SorobanTransactionData.fromXDR(transactionData, 'base64').resources;
  return [...footprint.readOnly, ...footprint.readWrite].map((k) => k.toXDR('base64'));
}

interface LedgerEntriesResponse {
  latestLedger: number;
  entries?: {
    xdr: string;
    lastModifiedLedgerSeq: number;
    liveUntilLedgerSeq?: number;
    extXdr?: string;
  }[];
}

async function recordCall(options: ForkOptions, call: ForkCall): Promise<ForkCallRecording> {
  const { rpc, networkPassphrase, source } = options;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const live = await rpc.call<RawSimulateResponse>('simulateTransaction', {
      transaction: envelope(call, source, networkPassphrase),
    });
    if (live.error !== undefined || live.transactionData === undefined) {
      // A failed simulation has no footprint to fetch: nothing to fork. Say why.
      throw new Error(
        `The live simulation of ${call.fn} did not succeed, so there is no footprint to fork: ${live.error ?? 'no transactionData'}`,
      );
    }
    if (live.restorePreamble !== undefined) {
      throw new Error(
        `${call.fn} touches archived entries that need restoring first; fork a call on live state.`,
      );
    }
    const keys = footprintKeys(live.transactionData);
    const fetched = await rpc.call<LedgerEntriesResponse>('getLedgerEntries', { keys });
    const latest = await rpc.call<{ sequence: number; closeTime: string }>('getLatestLedger');
    // The simulation and the entries must come from the same ledger, or the replay compares
    // different states. Ledgers close every ~5s; retry if one closed in between.
    if (fetched.latestLedger === live.latestLedger && latest.sequence === live.latestLedger) {
      return {
        contractId: call.contractId,
        fn: call.fn,
        args: [...(call.args ?? [])],
        live,
        entries: (fetched.entries ?? []).map((e) => ({
          xdr: e.xdr,
          lastModifiedLedgerSeq: e.lastModifiedLedgerSeq,
          ...(e.liveUntilLedgerSeq === undefined
            ? {}
            : { liveUntilLedgerSeq: e.liveUntilLedgerSeq }),
          ...(e.extXdr === undefined ? {} : { extXdr: e.extXdr }),
        })),
        ledger: live.latestLedger,
        closeTime: Number(latest.closeTime),
      };
    }
  }
  throw new Error(
    `Could not read ${call.fn}'s simulation and state at the same ledger after ${MAX_ATTEMPTS} attempts.`,
  );
}

/**
 * Record calls against a live network: for each, Stellar RPC's own simulation
 * (which tells us what the call touches) and the live ledger entries it
 * touches, read at the same ledger. {@link replayFork} then runs them offline.
 */
export async function recordFork(
  options: ForkOptions,
  calls: readonly ForkCall[],
): Promise<ForkRecording> {
  const config = await fetchNetworkConfig(options.rpc, options.networkPassphrase);
  const recorded: ForkCallRecording[] = [];
  for (const call of calls) recorded.push(await recordCall(options, call));
  return {
    networkPassphrase: options.networkPassphrase,
    protocolVersion: config.protocolVersion,
    source: options.source,
    configEntries: config.configEntries,
    calls: recorded,
  };
}

/**
 * Run recorded calls on the in-process engine, each on a fresh ledger holding
 * exactly the live state it was recorded with, and compare with the network's
 * own answer. No network is used.
 */
export function replayFork(recording: ForkRecording): ForkResult[] {
  return recording.calls.map((c) => {
    const net = LocalNetwork.create(
      {
        networkPassphrase: recording.networkPassphrase,
        protocolVersion: recording.protocolVersion,
        latestLedger: c.ledger,
        configEntries: recording.configEntries,
      },
      { timestamp: c.closeTime, sourceAccount: recording.source },
    );
    net.loadEntries(c.entries);
    const local = net.invoke(c.contractId, c.fn, [...c.args], { commit: false });
    const live = decodeSimulationResponse(c.live);
    return {
      call: { contractId: c.contractId, fn: c.fn, args: c.args },
      live,
      local,
      differences: compareSimulations(live, local.report),
    };
  });
}

/**
 * Fork a live network for the given calls and check the engine against it:
 * record, then replay. For ad hoc checks; tests should record once and replay
 * the recording, so they do not depend on the network.
 */
export async function forkAndCompare(
  options: ForkOptions,
  calls: readonly ForkCall[],
): Promise<ForkResult[]> {
  return replayFork(await recordFork(options, calls));
}
