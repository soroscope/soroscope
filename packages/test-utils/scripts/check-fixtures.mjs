#!/usr/bin/env node
// Fails when any committed fixture lacks a provenance block. Fixtures must be
// recorded from a real network, never written by hand.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
let bad = 0;
let count = 0;
for (const pkg of readdirSync(root)) {
  const dir = resolve(root, pkg, 'tests/fixtures');
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    continue;
  }
  for (const f of files) {
    count += 1;
    const data = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
    const p = data.provenance;
    if (!p || typeof p.tool !== 'string' || typeof p.recordedAt !== 'string') {
      console.error(`MISSING PROVENANCE: ${pkg}/tests/fixtures/${f}`);
      bad += 1;
    }
  }
}
if (bad > 0) process.exit(1);
console.log(`ok: ${count} fixture file(s) all carry provenance`);
