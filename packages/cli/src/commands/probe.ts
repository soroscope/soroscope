import { createServer } from 'node:http';
import { probeProviders, toJson, toPrometheus, toTable } from '@soroscope/core';
import type { ProbeReport } from '@soroscope/core';
import { CliError, ExitCode } from '../exit';
import type { ExitCodeValue } from '../exit';
import type { Io } from '../io';
import { resolveProviders } from '../providers';
import type { GlobalOptions } from '../providers';

export interface ProbeCommandOptions extends GlobalOptions {
  samples: string;
  burst: string;
  reach: boolean;
  format: string;
  timeout: string;
  strict?: boolean;
  watch?: boolean;
  interval: string;
  serve?: string;
}

function positiveInt(label: string, raw: string, min: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw new CliError(`${label} must be an integer >= ${min} (got "${raw}").`, ExitCode.Usage);
  }
  return n;
}

function render(report: ProbeReport, format: string, network: string): string {
  switch (format) {
    case 'table':
      return toTable(report);
    case 'json':
      return toJson(report);
    case 'prometheus':
      return toPrometheus(report, network);
    default:
      throw new CliError(`Unknown format "${format}". Use table, json or prometheus.`, ExitCode.Usage);
  }
}

/** 0 when something answers; 3 when nothing does; 1 when `--strict` and anything is unhealthy. */
export function exitCodeFor(report: ProbeReport, strict: boolean): ExitCodeValue {
  const { healthy, degraded } = report.summary;
  if (healthy + degraded === 0) return ExitCode.Network;
  if (strict && report.providers.some((p) => p.status !== 'healthy')) return ExitCode.Failure;
  return ExitCode.Ok;
}

export async function runProbe(opts: ProbeCommandOptions, io: Io): Promise<ExitCodeValue> {
  const selection = resolveProviders(opts);
  const samples = positiveInt('--samples', opts.samples, 1);
  const burst = positiveInt('--burst', opts.burst, 0);
  const timeoutMs = positiveInt('--timeout', opts.timeout, 1) * 1000;
  const intervalMs = positiveInt('--interval', opts.interval, 1) * 1000;
  // Validate the format up front so a typo fails before the slow part.
  render({ generatedAt: '', providers: [], summary: { healthy: 0, degraded: 0, unreachable: 0, misconfigured: 0, maxLatestLedger: null } }, opts.format, selection.network);

  const probe = (): Promise<ProbeReport> =>
    probeProviders(selection.urls, { samples, burst, reach: opts.reach, timeoutMs });

  if (opts.serve !== undefined) {
    return serve(opts, selection.network, probe, positiveInt('--serve', opts.serve, 1), intervalMs, io);
  }

  if (opts.watch === true) {
    for (;;) {
      const report = await probe();
      io.out(render(report, opts.format, selection.network));
      io.out('');
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  io.err(`Probing ${selection.urls.length} provider(s) on ${selection.network}...`);
  const report = await probe();
  io.out(render(report, opts.format, selection.network));
  return exitCodeFor(report, opts.strict === true);
}

/** Serve `/metrics` (Prometheus) and `/probe` (JSON), re-probing on an interval. */
function serve(
  opts: ProbeCommandOptions,
  network: string,
  probe: () => Promise<ProbeReport>,
  port: number,
  intervalMs: number,
  io: Io,
): Promise<ExitCodeValue> {
  let latest: ProbeReport | undefined;
  let running = false;
  const refresh = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      latest = await probe();
    } catch (err) {
      io.err(`probe failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
    }
  };

  const server = createServer((req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(latest === undefined ? 503 : 200, { 'content-type': 'text/plain; version=0.0.4' });
      res.end(latest === undefined ? '# no probe has completed yet\n' : toPrometheus(latest, network));
    } else if (req.url === '/probe') {
      res.writeHead(latest === undefined ? 503 : 200, { 'content-type': 'application/json' });
      res.end(latest === undefined ? '{"error":"no probe has completed yet"}' : toJson(latest));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found. Try /metrics or /probe.\n');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      reject(new CliError(`Cannot listen on port ${port}: ${err.message}`, ExitCode.Failure));
    });
    server.listen(port, () => {
      io.err(`Serving http://localhost:${port}/metrics and /probe (re-probing every ${intervalMs / 1000}s). Ctrl+C to stop.`);
      void refresh();
      const timer = setInterval(() => void refresh(), intervalMs);
      const stop = (): void => {
        clearInterval(timer);
        server.close(() => resolve(ExitCode.Ok));
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    void opts;
  });
}
