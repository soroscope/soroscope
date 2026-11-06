import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_PACKAGES, enginePackageFor } from '../../src/platform';

interface PlatformEntry {
  package: string;
  os: string;
  cpu: string;
  libc?: 'glibc' | 'musl';
  rustTarget: string;
  runner: string;
  library: string;
}
const platforms = JSON.parse(
  readFileSync(resolve(__dirname, '../../engine/platforms.json'), 'utf8'),
) as PlatformEntry[];

describe('engine platforms', () => {
  it('maps every released platform to its package, and nothing else', () => {
    for (const p of platforms) {
      expect(enginePackageFor({ platform: p.os, arch: p.cpu, libc: p.libc }), p.package).toBe(
        p.package,
      );
    }
    expect(Object.values(ENGINE_PACKAGES).sort()).toEqual(platforms.map((p) => p.package).sort());
  });

  it('names every package after its os, cpu and libc', () => {
    for (const p of platforms) expect(p.package).toContain(`dev-${p.os}-${p.cpu}`);
  });

  it('has no package for a platform it cannot build for', () => {
    expect(enginePackageFor({ platform: 'linux', arch: 'x64', libc: 'musl' })).toBeUndefined();
    expect(enginePackageFor({ platform: 'freebsd', arch: 'x64' })).toBeUndefined();
    expect(enginePackageFor({ platform: 'win32', arch: 'arm64' })).toBeUndefined();
  });

  it('assumes glibc on Linux when it cannot tell', () => {
    expect(enginePackageFor({ platform: 'linux', arch: 'x64' })).toBe(
      '@soroscope/dev-linux-x64-gnu',
    );
  });
});
