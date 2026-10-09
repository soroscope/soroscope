import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ConfigError, loadConfig } from './config';
import { COMMENT_MARKER, renderMarkdown } from './render';
import { runChecks } from './run';
import type { CheckReport } from './compare';

/** Inputs declared in action.yml. GitHub passes them as `INPUT_<NAME>` with dashes kept. */
export interface ActionInputs {
  config: string;
  updateBaseline: boolean;
  githubToken: string;
  comment: boolean;
  failOn: 'regression' | 'warning' | 'never';
  deployerSecret: string;
  workingDirectory: string;
}

const input = (env: NodeJS.ProcessEnv, name: string, fallback = ''): string => {
  const v = env[`INPUT_${name.toUpperCase()}`];
  return v === undefined || v.trim() === '' ? fallback : v.trim();
};

/** Read the Action's inputs from the environment. */
export function readInputs(env: NodeJS.ProcessEnv): ActionInputs {
  const failOn = input(env, 'fail-on', 'regression');
  if (failOn !== 'regression' && failOn !== 'warning' && failOn !== 'never') {
    throw new Error(`Input fail-on must be regression, warning or never (got "${failOn}")`);
  }
  return {
    config: input(env, 'config', 'soroscope.config.json'),
    updateBaseline: input(env, 'update-baseline', 'false') === 'true',
    githubToken: input(env, 'github-token'),
    comment: input(env, 'comment', 'true') === 'true',
    failOn,
    deployerSecret: input(env, 'deployer-secret'),
    workingDirectory: input(env, 'working-directory', '.'),
  };
}

/** Escape a value for a GitHub workflow command (`::error::message`). */
function escapeCommand(text: string): string {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Emit error/warning annotations for every finding that is not just information. */
export function annotations(report: CheckReport): string[] {
  const out: string[] = [];
  for (const inv of report.invocations) {
    for (const f of inv.findings) {
      if (f.level === 'info') continue;
      out.push(`::${f.level === 'fail' ? 'error' : 'warning'} title=Soroscope ${escapeCommand(inv.name)}::${escapeCommand(f.message)}`);
    }
  }
  return out;
}

interface GitHubContext {
  repository: string;
  apiUrl: string;
  pullRequest: number | null;
}

/** Work out which pull request this run belongs to, if any. */
export function githubContext(env: NodeJS.ProcessEnv): GitHubContext | null {
  const repository = env['GITHUB_REPOSITORY'];
  if (repository === undefined) return null;
  let pullRequest: number | null = null;
  const eventPath = env['GITHUB_EVENT_PATH'];
  if (eventPath !== undefined) {
    try {
      const event = JSON.parse(readFileSync(eventPath, 'utf8')) as { pull_request?: { number?: number }; number?: number };
      pullRequest = event.pull_request?.number ?? null;
    } catch {
      pullRequest = null;
    }
  }
  return { repository, apiUrl: env['GITHUB_API_URL'] ?? 'https://api.github.com', pullRequest };
}

type Fetch = typeof fetch;

/**
 * Post the report as a PR comment, updating the Action's own earlier comment
 * (found by {@link COMMENT_MARKER}) instead of adding a new one each run.
 * Returns false when the token cannot write (for example a pull request from
 * a fork), in which case the job summary still carries the report.
 */
export async function upsertComment(
  ctx: GitHubContext,
  token: string,
  body: string,
  fetchImpl: Fetch = fetch,
): Promise<boolean> {
  if (ctx.pullRequest === null) return false;
  const base = `${ctx.apiUrl}/repos/${ctx.repository}/issues`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'content-type': 'application/json',
    'user-agent': 'soroscope-ci',
  };
  const list = await fetchImpl(`${base}/${ctx.pullRequest}/comments?per_page=100`, { headers });
  if (!list.ok) return false;
  const comments = (await list.json()) as { id: number; body?: string }[];
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER) === true);
  const res = existing
    ? await fetchImpl(`${base}/comments/${existing.id}`, { method: 'PATCH', headers, body: JSON.stringify({ body }) })
    : await fetchImpl(`${base}/${ctx.pullRequest}/comments`, { method: 'POST', headers, body: JSON.stringify({ body }) });
  return res.ok;
}

/** Entry point of the GitHub Action. Returns the process exit code. */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let inputs: ActionInputs;
  try {
    inputs = readInputs(env);
  } catch (err) {
    process.stdout.write(`::error::${escapeCommand(err instanceof Error ? err.message : String(err))}\n`);
    return 1;
  }
  if (inputs.deployerSecret !== '') process.stdout.write(`::add-mask::${inputs.deployerSecret}\n`);

  try {
    const loaded = loadConfig(resolve(inputs.workingDirectory, inputs.config));
    const result = await runChecks({
      loaded,
      updateBaseline: inputs.updateBaseline,
      ...(inputs.deployerSecret === '' ? {} : { deployerSecret: inputs.deployerSecret }),
      log: (m) => process.stdout.write(`${m}\n`),
    });
    const { report } = result;
    const markdown = renderMarkdown(report);

    const reportPath = join(env['RUNNER_TEMP'] ?? resolve(inputs.workingDirectory), 'soroscope-report.md');
    writeFileSync(reportPath, markdown);
    if (env['GITHUB_STEP_SUMMARY'] !== undefined) appendFileSync(env['GITHUB_STEP_SUMMARY'], markdown);
    if (env['GITHUB_OUTPUT'] !== undefined) {
      appendFileSync(
        env['GITHUB_OUTPUT'],
        `result=${report.result}\nregressions=${report.counts.fail}\nreport-path=${reportPath}\n`,
      );
    }
    for (const line of annotations(report)) process.stdout.write(`${line}\n`);

    const ctx = githubContext(env);
    if (inputs.comment && inputs.githubToken !== '' && ctx !== null) {
      const posted = await upsertComment(ctx, inputs.githubToken, markdown);
      if (!posted && ctx.pullRequest !== null) {
        process.stdout.write('::notice::Could not write the PR comment (read-only token, for example on a fork). The report is in the job summary.\n');
      }
    }
    if (result.baselineWritten) process.stdout.write(`Baseline written to ${result.baselinePath}\n`);

    if (inputs.updateBaseline || inputs.failOn === 'never') return 0;
    if (report.result === 'fail') return 1;
    if (report.result === 'warn' && inputs.failOn === 'warning') return 1;
    return 0;
  } catch (err) {
    const message = err instanceof ConfigError || err instanceof Error ? err.message : String(err);
    process.stdout.write(`::error title=Soroscope::${escapeCommand(message)}\n`);
    return 1;
  }
}

// Run when executed as the Action's entry point (the bundle sets SOROSCOPE_ACTION_ENTRY).
if (process.env['SOROSCOPE_ACTION_ENTRY'] === '1') {
  void main().then((code) => {
    process.exitCode = code;
  });
}
