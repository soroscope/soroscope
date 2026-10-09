import type { CheckReport, Finding, InvocationResult } from './compare';

/** Marker that lets the Action find and update its own PR comment instead of posting a new one. */
export const COMMENT_MARKER = '<!-- soroscope-ci -->';

const WORD: Record<string, string> = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', new: 'NEW', info: 'INFO' };

/** Make untrusted text safe for a markdown table cell. */
function cell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').replace(/</g, '&lt;').slice(0, 300);
}

const num = (s: string | undefined): string => (s === undefined ? '' : /^\d+$/.test(s) ? BigInt(s).toLocaleString('en-US') : s);

function row(inv: InvocationResult, f: Finding): string {
  const delta =
    f.deltaPct === undefined || f.deltaPct === null ? '' : `${f.deltaPct > 0 ? '+' : ''}${f.deltaPct}%`;
  return `| ${cell(inv.name)} | ${cell(f.metric)} | ${cell(num(f.baseline))} | ${cell(num(f.current))} | ${delta} | ${WORD[f.level]} | ${cell(f.message)} |`;
}

/** Render the report as a GitHub PR comment / job summary. */
export function renderMarkdown(report: CheckReport): string {
  const { counts } = report;
  const lines: string[] = [COMMENT_MARKER];
  const headline =
    report.result === 'fail'
      ? `FAIL (${counts.fail} invocation${counts.fail === 1 ? '' : 's'} regressed)`
      : report.result === 'warn'
        ? `WARN (${counts.warn + counts.new} need attention)`
        : 'PASS';
  lines.push(`## Soroscope resource report: ${headline}`, '');
  lines.push(
    `Network ${report.environment.network}${report.environment.protocolVersion === null ? '' : `, protocol ${report.environment.protocolVersion}`}. ` +
      `${report.invocations.length} invocation${report.invocations.length === 1 ? '' : 's'} checked.`,
  );
  if (report.environmentChanged) {
    lines.push('', 'The protocol version differs from the baseline, so fee changes are reported as warnings, not failures.');
  }

  const rows = report.invocations.flatMap((inv) =>
    inv.findings.filter((f) => f.level !== 'info').map((f) => row(inv, f)),
  );
  if (rows.length > 0) {
    lines.push(
      '',
      '| Invocation | Metric | Baseline | Current | Change | Status | Detail |',
      '|---|---|---:|---:|---:|---|---|',
      ...rows,
    );
  } else {
    lines.push('', 'No regressions.');
  }

  const info = report.invocations.flatMap((inv) => inv.findings.filter((f) => f.level === 'info').map((f) => `- ${cell(inv.name)}: ${cell(f.message)}`));
  if (info.length > 0) lines.push('', '<details><summary>Improvements and notes</summary>', '', ...info, '', '</details>');

  const summary = report.invocations
    .filter((i) => i.measurement.ok && i.measurement.metrics !== null)
    .map((i) => {
      const m = i.measurement.metrics!;
      return `| ${cell(i.name)} | ${WORD[i.status]} | ${num(m.instructions)} | ${num(m.diskReadBytes)} | ${num(m.writeBytes)} | ${num(m.resourceFee)} | ${m.readOnlyKeys}/${m.readWriteKeys} |`;
    });
  if (summary.length > 0) {
    lines.push(
      '',
      '<details><summary>All measurements</summary>',
      '',
      '| Invocation | Status | Instructions | Disk read bytes | Write bytes | Resource fee | Keys (read/write) |',
      '|---|---|---:|---:|---:|---:|---:|',
      ...summary,
      '',
      '</details>',
    );
  }
  if (report.removed.length > 0) {
    lines.push('', `Baseline entries with no matching invocation: ${report.removed.map(cell).join(', ')}`);
  }
  lines.push('', 'Measured with `simulateTransaction`; run `soroscope check --update-baseline` to accept the current numbers.');
  return `${lines.join('\n')}\n`;
}

/** A compact plain-text report for terminals. */
export function renderText(report: CheckReport): string {
  const lines: string[] = [];
  for (const inv of report.invocations) {
    const m = inv.measurement.metrics;
    const detail = m === null ? '' : `  instructions ${num(m.instructions)}, fee ${num(m.resourceFee)}, keys ${m.readOnlyKeys}/${m.readWriteKeys}`;
    lines.push(`${(WORD[inv.status] ?? "").padEnd(4)}  ${inv.name}${detail}`);
    for (const f of inv.findings) {
      if (f.level === 'info') continue;
      lines.push(`        ${WORD[f.level]}: ${f.message}`);
    }
  }
  if (report.removed.length > 0) lines.push(`      removed from config: ${report.removed.join(', ')}`);
  lines.push('', `Result: ${WORD[report.result]} (${report.counts.pass} pass, ${report.counts.warn} warn, ${report.counts.new} new, ${report.counts.fail} fail)`);
  return lines.join('\n');
}
