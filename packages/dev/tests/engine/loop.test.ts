import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DevLoop, DevSession, type DevLoopEvent } from '../../src';
import { fixture, recordedAt } from './helpers';

// End to end with a real compiler: a copy of the fixture contract is built,
// loaded, edited on disk, rebuilt and hot-swapped. The first build compiles
// soroban-sdk and takes minutes when the cache is cold; later builds take seconds.
const FIXTURE = resolve(__dirname, '../../../test-utils/fixture-contract');
// Shared across runs (and cached in CI) so only the contract recompiles.
process.env.CARGO_TARGET_DIR ??= resolve(__dirname, '../../engine/target/loop-test');

describe('DevLoop (real builds)', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'soroscope-loop-'));
  const lib = resolve(dir, 'src/lib.rs');
  const events: DevLoopEvent[] = [];
  const waiters: { match: (e: DevLoopEvent) => boolean; resolve: (e: DevLoopEvent) => void }[] = [];
  const session = DevSession.create(fixture, { timestamp: recordedAt });
  const loop = new DevLoop({
    projectDir: dir,
    session,
    builder: 'cargo',
    onEvent: (e) => {
      events.push(e);
      for (const w of waiters.splice(0)) {
        if (w.match(e)) w.resolve(e);
        else waiters.push(w);
      }
    },
  });
  const next = (match: (e: DevLoopEvent) => boolean): Promise<DevLoopEvent> =>
    new Promise((r) => waiters.push({ match, resolve: r }));
  const edit = (from: string, to: string): void => {
    const src = readFileSync(lib, 'utf8');
    expect(src).toContain(from);
    writeFileSync(lib, src.replace(from, to));
  };

  beforeAll(async () => {
    for (const f of ['Cargo.toml', 'Cargo.lock', 'src'])
      cpSync(resolve(FIXTURE, f), resolve(dir, f), { recursive: true });
    await loop.start();
  }, 900_000);

  afterAll(() => {
    loop.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it('builds and deploys on start', () => {
    const loaded = events.find((e) => e.type === 'reloaded');
    expect(loaded?.type === 'reloaded' && loaded.result.kind).toBe('deployed');
    session.call('init', { admin: 'me' });
    session.call('mint', { to: 'me', amount: '250' });
  });

  it('rebuilds on save and swaps the code in place, keeping storage', async () => {
    const swapped = next((e) => e.type === 'reloaded' || e.type === 'build-failed');
    edit(
      '    pub fn work(',
      '    pub fn hello(_env: Env) -> u32 {\n        7\n    }\n\n    pub fn work(',
    );
    const e = await swapped;
    expect(e.type).toBe('reloaded');
    if (e.type !== 'reloaded') return;
    expect(e.result.kind).toBe('swapped');
    expect(e.result.diff.added).toEqual(['hello']);
    expect(session.call('hello').value).toBe(7);
    expect(session.call('balance', { who: 'me' }).value).toBe('250');
  }, 300_000);

  it('reports a compile error and keeps the last good build running', async () => {
    const failed = next((e) => e.type === 'build-failed' || e.type === 'reloaded');
    edit('        7\n', '        7 +\n');
    const e = await failed;
    expect(e.type).toBe('build-failed');
    if (e.type === 'build-failed') expect(e.output).toMatch(/error/);
    expect(session.call('hello').value).toBe(7);

    const fixed = next((x) => x.type === 'reloaded' || x.type === 'build-failed');
    edit('        7 +\n', '        8\n');
    const ok = await fixed;
    expect(ok.type === 'reloaded' && ok.result.diff).toEqual({
      added: [],
      removed: [],
      changed: [],
    });
    expect(session.call('hello').value).toBe(8);
  }, 300_000);
});
