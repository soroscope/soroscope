import { cpSync, mkdtempSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveProject } from '../../src';

const FIXTURE = resolve(__dirname, '../../../test-utils/fixture-contract');

describe('resolveProject', () => {
  const real = mkdtempSync(resolve(tmpdir(), 'soroscope-project-'));
  for (const f of ['Cargo.toml', 'Cargo.lock', 'src']) cpSync(resolve(FIXTURE, f), resolve(real, f), { recursive: true });

  it('finds the crate in a directory', async () => {
    const project = await resolveProject(real);
    expect(project.packageName).toBe('soroscope-fixture-contract');
    expect(project.dir).toBe(realpathSync(real));
  });

  it('finds it through a symlink, as on macOS where /tmp and /var are symlinks', async () => {
    const link = resolve(mkdtempSync(resolve(tmpdir(), 'soroscope-link-')), 'project');
    symlinkSync(real, link);
    const project = await resolveProject(link);
    expect(project.packageName).toBe('soroscope-fixture-contract');
    expect(project.dir).toBe(realpathSync(real));
  });
});
