import type { RpcCaller } from '../rpc/types';
import { fetchContractSpec } from '../spec/fetch';
import { resolveContractError } from '../spec/contractError';
import { decodeSimulationResponse } from './report';
import { SimulationError } from './types';
import type {
  RawSimulateResponse,
  SimulateOptions,
  SimulateTransactionParams,
  SimulationReport,
} from './types';

/**
 * Runs `simulateTransaction` through any {@link RpcCaller} (one endpoint or a
 * router) and returns a fully decoded {@link SimulationReport}.
 *
 * @example
 * const sim = new TransactionSimulator(router);
 * const report = await sim.simulate(txXdr);
 * console.log(describeSimulation(report));
 */
export class TransactionSimulator {
  constructor(private readonly caller: RpcCaller) {}

  /**
   * Simulate a transaction.
   * @param transactionXdr - Base64 `TransactionEnvelope`.
   * @throws {TypeError} If `transactionXdr` is empty.
   */
  async simulate(transactionXdr: string, options: SimulateOptions = {}): Promise<SimulationReport> {
    if (typeof transactionXdr !== 'string' || transactionXdr === '') {
      throw new TypeError('TransactionSimulator.simulate: transactionXdr must be a non-empty string');
    }
    const params: SimulateTransactionParams = { transaction: transactionXdr };
    if (options.instructionLeeway !== undefined) {
      params.resourceConfig = { instructionLeeway: options.instructionLeeway };
    }
    const raw = await this.caller.call<RawSimulateResponse>('simulateTransaction', params);
    return decodeSimulationResponse(raw);
  }

  /**
   * Simulate, and when the call fails with a contract error, look up the
   * contract's spec so the error carries its declared name.
   */
  async simulateAndExplain(
    transactionXdr: string,
    options: SimulateOptions = {},
  ): Promise<SimulationReport> {
    const report = await this.simulate(transactionXdr, options);
    if (report.failure?.contractId == null) return report;
    try {
      const spec = await fetchContractSpec(this.caller, report.failure.contractId);
      return { ...report, failure: resolveContractError(report.failure, spec) };
    } catch {
      // The spec is a nicety: an unreachable ledger entry must not hide the real failure.
      return report;
    }
  }

  /**
   * The minimum resource fee in stroops.
   * @throws {SimulationError} If the simulation fails.
   */
  async estimateFee(transactionXdr: string, options: SimulateOptions = {}): Promise<bigint> {
    const report = await this.simulate(transactionXdr, options);
    if (!report.ok || report.minResourceFee === null) {
      throw new SimulationError(report.error ?? 'Simulation returned no fee', report);
    }
    return report.minResourceFee;
  }
}

export default TransactionSimulator;
