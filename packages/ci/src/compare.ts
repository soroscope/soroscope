import type { Baseline, BaselineEntry, BaselineEnvironment } from './baseline';
import type { SoroscopeConfig } from './config';
import type { Measurement, NumericMetrics } from './metrics';

export type Level = 'fail' | 'warn' | 'info';

export interface Finding {
  invocation: string;
  metric: string;
  level: Level;
  message: string;
  baseline?: string;
  current?: string;
  /** Change relative to the baseline, in percent, when it is defined. */
  deltaPct?: number | null;
}

export type InvocationStatus = 'pass' | 'warn' | 'fail' | 'new';

export interface InvocationResult {
  name: string;
  status: InvocationStatus;
  measurement: Measurement;
  baseline: BaselineEntry | null;
  findings: Finding[];
}

export interface CheckReport {
  result: 'pass' | 'warn' | 'fail';
  environment: BaselineEnvironment;
  /** True when the baseline was recorded under a different protocol version. */
  environmentChanged: boolean;
  invocations: InvocationResult[];
  /** Baseline entries whose invocation no longer exists. */
  removed: string[];
  counts: { fail: number; warn: number; new: number; pass: number };
}

type GatedMetric = 'instructions' | 'diskReadBytes' | 'writeBytes' | 'resourceFee';

/** Defaults when a metric has no threshold of its own. Resource fee also moves with network fee settings, so it warns. */
const DEFAULTS: Record<GatedMetric, { pct: number; level: 'fail' | 'warn' | 'ignore' }> = {
  instructions: { pct: 5, level: 'fail' },
  diskReadBytes: { pct: 5, level: 'fail' },
  writeBytes: { pct: 5, level: 'fail' },
  resourceFee: { pct: 10, level: 'warn' },
};

const GATED: readonly GatedMetric[] = ['instructions', 'diskReadBytes', 'writeBytes', 'resourceFee'];

function pctChange(base: bigint, current: bigint): number | null {
  if (base === 0n) return null;
  return Number(((current - base) * 10000n) / base) / 100;
}

function compareMetric(
  name: string,
  metric: GatedMetric,
  base: bigint,
  current: bigint,
  config: SoroscopeConfig,
  environmentChanged: boolean,
): Finding | null {
  const t = config.thresholds[metric];
  const def = DEFAULTS[metric];
  const pct = t?.maxIncreasePct ?? def.pct;
  const abs = t?.maxIncreaseAbs ?? 0;
  let level = t?.level ?? def.level;
  if (level === 'ignore') return null;
  // A protocol upgrade can reprice resources without any code change: never fail on it.
  if (environmentChanged && metric === 'resourceFee' && level === 'fail') level = 'warn';

  const delta = current - base;
  const allowed = (base * BigInt(Math.round(pct * 100))) / 10000n + BigInt(Math.round(abs));
  const change = pctChange(base, current);
  const shown = { baseline: base.toString(), current: current.toString(), deltaPct: change };
  if (delta > allowed) {
    return {
      invocation: name,
      metric,
      level,
      message: `${metric} grew by ${delta} (${change === null ? 'from zero' : `${change > 0 ? '+' : ''}${change}%`}); allowed ${allowed}`,
      ...shown,
    };
  }
  if (delta < 0n && -delta > allowed) {
    return { invocation: name, metric, level: 'info', message: `${metric} improved by ${-delta}`, ...shown };
  }
  return null;
}

function compareFootprint(
  name: string,
  base: NonNullable<Measurement['footprint']>,
  current: NonNullable<Measurement['footprint']>,
  config: SoroscopeConfig,
): Finding[] {
  const out: Finding[] = [];
  const rules = config.thresholds.footprint;
  const baseRw = new Set(base.readWrite);
  const baseRo = new Set(base.readOnly);
  for (const key of current.readWrite) {
    if (baseRw.has(key)) continue;
    const promoted = baseRo.has(key);
    const allowed = promoted ? rules?.allowReadOnlyToReadWrite === true : rules?.allowNewKeys === true;
    out.push({
      invocation: name,
      metric: 'footprint',
      level: allowed ? 'info' : 'fail',
      message: promoted
        ? `now writes a ledger entry it only read before: ${key}`
        : `now writes a new ledger entry: ${key}`,
      current: key,
    });
  }
  for (const key of current.readOnly) {
    if (!baseRo.has(key) && !baseRw.has(key)) {
      out.push({ invocation: name, metric: 'footprint', level: 'warn', message: `now reads a new ledger entry: ${key}`, current: key });
    }
  }
  const now = new Set([...current.readOnly, ...current.readWrite]);
  for (const key of [...base.readOnly, ...base.readWrite]) {
    if (!now.has(key)) {
      out.push({ invocation: name, metric: 'footprint', level: 'info', message: `no longer touches ${key}`, baseline: key });
    }
  }
  return out;
}

function checkBudgets(name: string, m: NumericMetrics, config: SoroscopeConfig): Finding[] {
  const b = config.budgets;
  const out: Finding[] = [];
  const over = (metric: string, value: bigint, limit: bigint): void => {
    if (value > limit) {
      out.push({
        invocation: name,
        metric,
        level: 'fail',
        message: `${metric} ${value} exceeds the budget of ${limit}`,
        current: value.toString(),
        baseline: limit.toString(),
      });
    }
  };
  if (b.instructions !== undefined) over('instructions', BigInt(m.instructions), BigInt(b.instructions));
  if (b.diskReadBytes !== undefined) over('diskReadBytes', BigInt(m.diskReadBytes), BigInt(b.diskReadBytes));
  if (b.writeBytes !== undefined) over('writeBytes', BigInt(m.writeBytes), BigInt(b.writeBytes));
  if (b.resourceFee !== undefined) over('resourceFee', BigInt(m.resourceFee), BigInt(b.resourceFee));
  if (b.readWriteKeys !== undefined) over('readWriteKeys', BigInt(m.readWriteKeys), BigInt(b.readWriteKeys));
  return out;
}

export interface CompareInput {
  config: SoroscopeConfig;
  measurements: Readonly<Record<string, { function: string; measurement: Measurement; wasmSha256?: string }>>;
  baseline: Baseline | null;
  environment: BaselineEnvironment;
}

/**
 * Compare fresh measurements with a baseline. Pure: no network, no files.
 *
 * Rules: resource growth beyond its threshold fails (instructions, disk reads,
 * writes) or warns (resource fee); a new read-write ledger entry fails, as does
 * a read-only entry becoming read-write; absolute budgets fail regardless of
 * the baseline; an invocation with no baseline is "new"; improvements are info.
 */
export function compareAll(input: CompareInput): CheckReport {
  const { config, measurements, baseline, environment } = input;
  const environmentChanged =
    baseline !== null &&
    baseline.environment.protocolVersion !== null &&
    environment.protocolVersion !== null &&
    baseline.environment.protocolVersion !== environment.protocolVersion;

  const results: InvocationResult[] = [];
  for (const inv of config.invocations) {
    const got = measurements[inv.name];
    if (got === undefined) throw new Error(`No measurement for invocation "${inv.name}"`);
    const m = got.measurement;
    const base = baseline?.entries[inv.name] ?? null;
    const findings: Finding[] = [];

    const expectSuccess = inv.expect?.success ?? true;
    if (m.ok !== expectSuccess) {
      findings.push({
        invocation: inv.name,
        metric: 'outcome',
        level: 'fail',
        message: expectSuccess
          ? `expected the call to succeed but it failed${m.errorName === null ? '' : ` with ${m.errorName}`}`
          : 'expected the call to fail but it succeeded',
      });
    } else if (!m.ok && inv.expect?.errorName !== undefined && m.errorName !== inv.expect.errorName) {
      findings.push({
        invocation: inv.name,
        metric: 'outcome',
        level: 'fail',
        message: `expected error ${inv.expect.errorName} but got ${m.errorName ?? 'a different error'}`,
        baseline: inv.expect.errorName,
        current: m.errorName ?? 'unnamed',
      });
    }

    if (m.ok && m.metrics !== null && m.footprint !== null) {
      findings.push(...checkBudgets(inv.name, m.metrics, config));
      if (base !== null && base.ok && base.metrics !== null && base.footprint !== null) {
        for (const metric of GATED) {
          const f = compareMetric(inv.name, metric, BigInt(base.metrics[metric]), BigInt(m.metrics[metric]), config, environmentChanged);
          if (f !== null) findings.push(f);
        }
        findings.push(...compareFootprint(inv.name, base.footprint, m.footprint, config));
      }
    }

    let status: InvocationStatus;
    if (m.ok && base === null) {
      status = 'new';
      findings.push({
        invocation: inv.name,
        metric: 'baseline',
        level: config.failOnMissingBaseline ? 'fail' : 'warn',
        message: 'no baseline entry yet; run with --update-baseline to record one',
      });
    } else status = 'pass';
    if (findings.some((f) => f.level === 'fail')) status = 'fail';
    else if (status === 'pass' && findings.some((f) => f.level === 'warn')) status = 'warn';
    else if (status === 'new' && config.failOnMissingBaseline) status = 'fail';

    results.push({ name: inv.name, status, measurement: m, baseline: base, findings });
  }

  const known = new Set(config.invocations.map((i) => i.name));
  const removed = Object.keys(baseline?.entries ?? {}).filter((n) => !known.has(n)).sort();
  const counts = {
    fail: results.filter((r) => r.status === 'fail').length,
    warn: results.filter((r) => r.status === 'warn').length,
    new: results.filter((r) => r.status === 'new').length,
    pass: results.filter((r) => r.status === 'pass').length,
  };
  return {
    result: counts.fail > 0 ? 'fail' : counts.warn + counts.new > 0 ? 'warn' : 'pass',
    environment,
    environmentChanged,
    invocations: results,
    removed,
    counts,
  };
}
