#!/usr/bin/env node
// Packages the native engine for one platform as an npm package, and wires the
// platform packages into @soroscope/dev as optional dependencies.
//
//   node scripts/package-engine.mjs matrix
//       Print the build matrix (engine/platforms.json) as JSON, for the workflow.
//   node scripts/package-engine.mjs package --package <name> --library <file> --out <dir>
//       Write <dir>/package.json and <dir>/soroscope-engine.node, ready for `npm publish`.
//   node scripts/package-engine.mjs link
//       Add every platform package to @soroscope/dev's optionalDependencies at its own
//       version. Run by the release workflow just before publishing @soroscope/dev; it is
//       not committed, because pnpm cannot resolve packages that are not published yet.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const platforms = JSON.parse(readFileSync(resolve(root, 'engine/platforms.json'), 'utf8'));
const devManifestPath = resolve(root, 'package.json');
const dev = JSON.parse(readFileSync(devManifestPath, 'utf8'));

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? undefined : process.argv[i + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`missing --${name}`);
    process.exit(2);
  }
  return value;
}

const command = process.argv[2];

if (command === 'matrix') {
  process.stdout.write(JSON.stringify({ include: platforms }));
} else if (command === 'package') {
  const name = arg('package');
  const platform = platforms.find((p) => p.package === name);
  if (platform === undefined) {
    console.error(`${name} is not in engine/platforms.json`);
    process.exit(2);
  }
  const out = resolve(arg('out'));
  mkdirSync(out, { recursive: true });
  copyFileSync(resolve(arg('library')), resolve(out, 'soroscope-engine.node'));
  copyFileSync(resolve(root, 'LICENSE'), resolve(out, 'LICENSE'));
  const manifest = {
    name,
    version: dev.version,
    description: `Prebuilt in-process Soroban engine for @soroscope/dev on ${platform.os}-${platform.cpu}${platform.libc ? `-${platform.libc}` : ''}. Install @soroscope/dev instead.`,
    main: 'soroscope-engine.node',
    files: ['soroscope-engine.node', 'LICENSE'],
    os: [platform.os],
    cpu: [platform.cpu],
    ...(platform.libc === undefined ? {} : { libc: [platform.libc] }),
    engines: dev.engines,
    license: dev.license,
    author: dev.author,
    repository: dev.repository,
    publishConfig: { access: 'public' },
  };
  writeFileSync(resolve(out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.error(`packaged ${name}@${dev.version} -> ${out}`);
} else if (command === 'link') {
  dev.optionalDependencies = Object.fromEntries(platforms.map((p) => [p.package, dev.version]));
  writeFileSync(devManifestPath, `${JSON.stringify(dev, null, 2)}\n`);
  console.error(`linked ${platforms.length} platform packages at ${dev.version}`);
} else {
  console.error('usage: package-engine.mjs matrix | package --package <name> --library <file> --out <dir> | link');
  process.exit(2);
}
