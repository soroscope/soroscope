import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    tsconfig: 'tsconfig.build.json',
  },
  {
    entry: { bin: 'src/bin.ts' },
    format: ['esm'],
    sourcemap: true,
    outDir: 'dist',
    tsconfig: 'tsconfig.build.json',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
