import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COMMENT_MARKER } from '../../src';

const run = promisify(execFile);
// The committed bundle: exactly what GitHub runs.
const BUNDLE = resolve(__dirname, '../../action/index.cjs');
const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../test-utils/fixtures/fixture-contract.json'), 'utf8'),
) as { contractId: string };

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'soroscope-action-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function runAction(inputs: Record<string, string>): Promise<{ code: number; stdout: string; summary: string; outputs: string }> {
  const summaryPath = join(dir, `summary-${Math.random()}.md`);
  const outputPath = join(dir, `output-${Math.random()}.txt`);
  writeFileSync(summaryPath, '');
  writeFileSync(outputPath, '');
  const env: NodeJS.ProcessEnv = {
    PATH: process.env['PATH'],
    HOME: process.env['HOME'],
    GITHUB_STEP_SUMMARY: summaryPath,
    GITHUB_OUTPUT: outputPath,
    RUNNER_TEMP: dir,
    ...Object.fromEntries(Object.entries(inputs).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v])),
  };
  try {
    const { stdout } = await run(process.execPath, [BUNDLE], { env, cwd: dir, timeout: 200_000 });
    return { code: 0, stdout, summary: readFileSync(summaryPath, 'utf8'), outputs: readFileSync(outputPath, 'utf8') };
  } catch (err) {
    const e = err as { code?: number; stdout?: string };
    return { code: typeof e.code === 'number' ? e.code : 1, stdout: e.stdout ?? '', summary: readFileSync(summaryPath, 'utf8'), outputs: readFileSync(outputPath, 'utf8') };
  }
}

function config(n: number): void {
  writeFileSync(
    join(dir, 'soroscope.config.json'),
    JSON.stringify({
      version: 1,
      invocations: [{ name: 'work', contractId: FIXTURE.contractId, function: 'work', args: { n } }],
    }),
  );
}

describe('the bundled GitHub Action, run as GitHub runs it (live testnet)', () => {
  it('records a baseline', { timeout: 200_000 }, async () => {
    config(10);
    const r = await runAction({ 'update-baseline': 'true' });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Baseline written');
  });

  it('passes against that baseline and reports through outputs and the job summary', { timeout: 200_000 }, async () => {
    config(10);
    const r = await runAction({});
    expect(r.code).toBe(0);
    expect(r.outputs).toContain('result=pass');
    expect(r.outputs).toContain('regressions=0');
    expect(r.summary.startsWith(COMMENT_MARKER)).toBe(true);
  });

  it('fails the job, annotates the regression and writes it to the summary', { timeout: 200_000 }, async () => {
    config(5000);
    const r = await runAction({});
    expect(r.code).toBe(1);
    expect(r.outputs).toContain('result=fail');
    expect(r.outputs).toContain('regressions=1');
    expect(r.stdout).toMatch(/::error title=Soroscope work::instructions grew/);
    expect(r.summary).toContain('FAIL');
  });

  it('fail-on: never reports the regression but does not fail the job', { timeout: 200_000 }, async () => {
    config(5000);
    const r = await runAction({ 'fail-on': 'never' });
    expect(r.code).toBe(0);
    expect(r.outputs).toContain('result=fail');
  });

  it('reports a bad config as a clear error, exit 1', { timeout: 60_000 }, async () => {
    writeFileSync(join(dir, 'broken.json'), '{ nope');
    const r = await runAction({ config: 'broken.json' });
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/::error title=Soroscope::.*not valid JSON/);
  });
});
