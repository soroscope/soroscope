#!/usr/bin/env node
// Bundles the GitHub Action into one self-contained file, action/index.cjs, so the Action
// runs without an `npm install`. The output is committed; CI fails if it drifts from source.
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [resolve(root, 'src/action.ts')],
  outfile: resolve(root, 'action/index.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // Not minified, so a change to the bundle is reviewable in a diff.
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  banner: { js: "process.env.SOROSCOPE_ACTION_ENTRY = '1';" },
  logLevel: 'info',
});
