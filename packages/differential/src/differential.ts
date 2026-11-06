import {
  RpcClient,
  decodeSimulationResponse,
  simulationFields,
  type RawSimulateResponse,
  type SimulationReport,
} from '@soroscope/core';

/** What one provider said about a simulated call. */
export interface ProviderAnswer {
  /** The provider's URL. */
  provider: string;
  /** Time to answer, in milliseconds. */
  latencyMs: number;
  /** The ledger it answered at. */
  latestLedger?: number;
  /** The decoded simulation, when the provider answered. */
  report?: SimulationReport;
  /** Why there is no report: the request failed (timeout, refused, HTTP error). Not a disagreement. */
  failure?: string;
}

/** One value a field takes across providers, and who said it. */
export interface ValueGroup {
  value: string;
  providers: string[];
}

/** A field the providers that answered do not agree on. */
export interface FieldDisagreement {
  /** `outcome`, `error`, `returnValue`, `auth`, `minResourceFee`, `instructions`, `diskReadBytes`, `writeBytes`, `footprint.readOnly` or `footprint.readWrite`. */
  field: string;
  /** The distinct values, largest group first. */
  groups: ValueGroup[];
  /**
   * True when the providers answered at different ledgers, which can explain a
   * difference in state-dependent fields without any provider being wrong.
   */
  ledgerSkew: boolean;
}

export interface DifferentialReport {
  answers: ProviderAnswer[];
  /** How many providers answered and were compared. */
  compared: number;
  disagreements: FieldDisagreement[];
}

const OUTCOME = 'outcome';

/**
 * Find where providers disagree about one simulated call. Providers that did
 * not answer are listed in `answers` but take no part in the comparison: a
 * timeout is not a disagreement. For each field, providers are grouped by the
 * value they gave; more than one group is a disagreement.
 *
 * If some providers report a failure and others a success, only `outcome` is
 * compared; the remaining fields exist only for the ones that succeeded and
 * are compared among them.
 */
export function compareProviders(answers: readonly ProviderAnswer[]): DifferentialReport {
  const answered = answers.filter(
    (a): a is ProviderAnswer & { report: SimulationReport } => a.report !== undefined,
  );
  const fields = answered.map((a) => ({ answer: a, fields: simulationFields(a.report) }));
  const names = [...new Set(fields.flatMap((f) => Object.keys(f.fields)))];
  const ledgers = new Set(answered.map((a) => a.latestLedger));
  const ledgerSkew = ledgers.size > 1;

  const disagreements: FieldDisagreement[] = [];
  for (const field of names) {
    // A field only exists for providers whose outcome has it (return value for successes, error for failures).
    const holders = fields.filter((f) => f.fields[field] !== undefined);
    const byValue = new Map<string, string[]>();
    for (const h of holders) {
      const v = h.fields[field]!;
      byValue.set(v, [...(byValue.get(v) ?? []), h.answer.provider]);
    }
    if (byValue.size > 1) {
      const groups = [...byValue]
        .map(([value, providers]) => ({ value, providers }))
        .sort((a, b) => b.providers.length - a.providers.length);
      disagreements.push({ field, groups, ledgerSkew });
    }
  }
  // When outcomes differ, the other fields describe different things: keep only the outcome.
  const outcome = disagreements.find((d) => d.field === OUTCOME);
  return {
    answers: [...answers],
    compared: answered.length,
    disagreements: outcome === undefined ? disagreements : [outcome],
  };
}

export interface DifferentialOptions {
  /** Providers to compare, by URL. */
  providers: readonly string[];
  /** Per-provider time budget in milliseconds. Default 30000. */
  timeoutMs?: number;
}

/**
 * Simulate `transaction` (a base64 `TransactionEnvelope`) on every provider
 * separately and report where they disagree. Each provider is asked directly,
 * not through a router: the point is to see them side by side.
 */
export async function differentialSimulate(
  transaction: string,
  options: DifferentialOptions,
): Promise<DifferentialReport> {
  const answers = await Promise.all(
    options.providers.map(async (provider): Promise<ProviderAnswer> => {
      const started = performance.now();
      try {
        const client = new RpcClient({ url: provider, timeoutMs: options.timeoutMs ?? 30_000 });
        const raw = await client.call<RawSimulateResponse>('simulateTransaction', { transaction });
        return {
          provider,
          latencyMs: Math.round(performance.now() - started),
          latestLedger: raw.latestLedger,
          report: decodeSimulationResponse(raw),
        };
      } catch (e) {
        return {
          provider,
          latencyMs: Math.round(performance.now() - started),
          failure: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );
  return compareProviders(answers);
}

const short = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const clip = (s: string, n = 60): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A plain-text summary of a differential report. */
export function describeDifferential(report: DifferentialReport): string {
  const lines: string[] = [];
  lines.push(`${report.compared} of ${report.answers.length} providers answered.`);
  for (const a of report.answers) {
    lines.push(
      a.report === undefined
        ? `  ✗ ${short(a.provider)}  ${a.failure ?? 'no answer'}`
        : `  ✓ ${short(a.provider)}  ledger ${a.latestLedger ?? '?'}  ${a.latencyMs}ms  ${a.report.ok ? 'succeeded' : 'failed'}`,
    );
  }
  if (report.compared < 2) {
    lines.push('Fewer than two providers answered, so there is nothing to compare.');
  } else if (report.disagreements.length === 0) {
    lines.push(
      'No disagreement: every provider that answered gave the same result, resources and footprint.',
    );
  } else {
    for (const d of report.disagreements) {
      lines.push(
        `DISAGREE on ${d.field}${d.ledgerSkew ? '  (providers answered at different ledgers)' : ''}`,
      );
      for (const g of d.groups)
        lines.push(`    ${clip(g.value)}  ←  ${g.providers.map(short).join(', ')}`);
    }
  }
  return lines.join('\n');
}
