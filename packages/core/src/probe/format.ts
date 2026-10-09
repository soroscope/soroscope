import type { ProbeReport, ProviderProbe } from './probe';

/** Plain JSON, stable key order is not guaranteed; parse it, do not diff it. */
export function toJson(report: ProbeReport): string {
  return JSON.stringify(report, null, 2);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

interface Metric {
  name: string;
  help: string;
  type: 'gauge';
  value: (p: ProviderProbe) => number | null;
}

const METRICS: readonly Metric[] = [
  {
    name: 'soroscope_provider_up',
    help: '1 if the provider answered getHealth, else 0.',
    type: 'gauge',
    value: (p) => (p.reachable ? 1 : 0),
  },
  {
    name: 'soroscope_provider_latency_p50_ms',
    help: 'Median getHealth latency in milliseconds.',
    type: 'gauge',
    value: (p) => p.latency.p50Ms,
  },
  {
    name: 'soroscope_provider_latency_p95_ms',
    help: '95th percentile getHealth latency in milliseconds.',
    type: 'gauge',
    value: (p) => p.latency.p95Ms,
  },
  {
    name: 'soroscope_provider_ledger_lag',
    help: 'Ledgers the provider trails the best provider in the probe.',
    type: 'gauge',
    value: (p) => p.ledger.lag,
  },
  {
    name: 'soroscope_provider_latest_ledger',
    help: 'Latest ledger the provider reported.',
    type: 'gauge',
    value: (p) => p.ledger.latest,
  },
  {
    name: 'soroscope_provider_oldest_ledger',
    help: 'Oldest ledger the provider advertises.',
    type: 'gauge',
    value: (p) => p.ledger.oldest,
  },
  {
    name: 'soroscope_provider_retention_days',
    help: 'Days of history the advertised retention window covers.',
    type: 'gauge',
    value: (p) => p.ledger.advertisedDays,
  },
  {
    name: 'soroscope_provider_getledgers_reach_days',
    help: 'Days back from latest that getLedgers was shown to serve.',
    type: 'gauge',
    value: (p) => p.reach.getLedgersDays,
  },
  {
    name: 'soroscope_provider_protocol_version',
    help: 'Protocol version the provider reports.',
    type: 'gauge',
    value: (p) => p.protocolVersion,
  },
];

/** Prometheus text exposition format (version 0.0.4). Unmeasured values are omitted. */
export function toPrometheus(report: ProbeReport, network: string = 'unknown'): string {
  const lines: string[] = [];
  for (const metric of METRICS) {
    lines.push(`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} ${metric.type}`);
    for (const p of report.providers) {
      const v = metric.value(p);
      if (v === null || !Number.isFinite(v)) continue;
      lines.push(
        `${metric.name}{provider="${escapeLabel(p.provider)}",network="${escapeLabel(network)}"} ${Number.isInteger(v) ? v : v.toFixed(2)}`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

/** One row of the human-readable table. */
export interface TableRow {
  provider: string;
  status: string;
  p50: string;
  p95: string;
  lag: string;
  window: string;
  reach: string;
  protocol: string;
}

const fmtMs = (v: number | null): string => (v === null ? '-' : `${Math.round(v)}ms`);
const fmtDays = (v: number | null): string =>
  v === null ? '-' : v >= 10 ? `${Math.round(v)}d` : `${v.toFixed(1)}d`;

export function toTableRows(report: ProbeReport): TableRow[] {
  return report.providers.map((p) => ({
    provider: p.provider,
    status: p.status,
    p50: fmtMs(p.latency.p50Ms),
    p95: fmtMs(p.latency.p95Ms),
    lag: p.ledger.lag === null ? '-' : String(p.ledger.lag),
    window: fmtDays(p.ledger.advertisedDays),
    reach:
      p.reach.getLedgersDays === null
        ? '-'
        : `${fmtDays(p.reach.getLedgersDays)}${p.reach.beyondWindow ? '*' : ''}${p.reach.consistent ? '' : '?'}`,
    protocol: p.protocolVersion === null ? '-' : String(p.protocolVersion),
  }));
}

/** Render rows as an aligned plain-text table. */
export function toTable(report: ProbeReport): string {
  const rows = toTableRows(report);
  const cols: { key: keyof TableRow; title: string }[] = [
    { key: 'provider', title: 'PROVIDER' },
    { key: 'status', title: 'STATUS' },
    { key: 'p50', title: 'P50' },
    { key: 'p95', title: 'P95' },
    { key: 'lag', title: 'LAG' },
    { key: 'window', title: 'WINDOW' },
    { key: 'reach', title: 'LEDGERS REACH' },
    { key: 'protocol', title: 'PROTO' },
  ];
  const widths = cols.map((c) => Math.max(c.title.length, ...rows.map((r) => r[c.key].length)));
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  const out = [line(cols.map((c) => c.title)), ...rows.map((r) => line(cols.map((c) => r[c.key])))];
  if (rows.some((r) => r.reach.includes('*'))) {
    out.push('', '* getLedgers reaches beyond the advertised window (getTransactions/getEvents do not).');
  }
  if (rows.some((r) => r.reach.includes('?'))) {
    out.push('? inconsistent: the provider answered the same lookup differently on retry.');
  }
  return out.join('\n');
}
