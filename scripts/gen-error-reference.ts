#!/usr/bin/env tsx
/**
 * Generates the docs-site error reference page directly from the SDK's
 * canonical code catalogs (`packages/core/src/decode/codes.ts`), so the
 * documented error tables can never drift from what the decoder actually
 * returns.
 *
 *   pnpm docs:errors          # regenerate the page
 *   pnpm docs:errors --check  # fail if the page is out of date
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TX_RESULT_CODES,
  OP_RESULT_CODES,
  INVOKE_HOST_FUNCTION_CODES,
  EXTEND_FOOTPRINT_TTL_CODES,
  RESTORE_FOOTPRINT_CODES,
  SC_ERROR_TYPES,
  SC_ERROR_CODES,
  type CodeInfo,
} from '../packages/core/src/decode/codes'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'packages/demo/content/api/error-reference.md')
const check = process.argv.includes('--check')

const esc = (s: string) => s.replace(/\|/g, '\\|')

/** Render a code table sorted success-first (descending numeric value). */
function table(codes: Readonly<Record<number, CodeInfo>>): string {
  const rows = Object.entries(codes)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([code, info]) => `| \`${code}\` | \`${info.name}\` | ${esc(info.message)} |`)
    .join('\n')
  return `| Code | Name | Meaning |\n| --- | --- | --- |\n${rows}`
}

const page = `---
title: Error Reference
description: Every Stellar and Soroban result code Soroscope decodes, with plain-English meanings.
generated: true
---

<!-- Generated from packages/core/src/decode/codes.ts by scripts/gen-error-reference.ts. Do not edit directly; run \`pnpm docs:errors\`. -->

This page lists every result code the [error decoder](/docs/api/error-decoding) recognises,
generated straight from the SDK's source so it always matches what \`explainTransactionError\`
and \`decodeTransactionResult\` actually return.

---

## Transaction result codes

The transaction-level verdict (\`TransactionResultCode\`). Returned in \`code\` by
\`decodeTransactionResult\`.

${table(TX_RESULT_CODES)}

---

## Operation result codes

The outer operation envelope (\`OperationResultCode\`). \`opINNER\` means the operation ran and
its inner result carries the detail.

${table(OP_RESULT_CODES)}

---

## Soroban operation codes

### \`INVOKE_HOST_FUNCTION\`

${table(INVOKE_HOST_FUNCTION_CODES)}

### \`EXTEND_FOOTPRINT_TTL\`

${table(EXTEND_FOOTPRINT_TTL_CODES)}

### \`RESTORE_FOOTPRINT\`

${table(RESTORE_FOOTPRINT_CODES)}

---

## Contract error (\`ScError\`)

\`decodeScError\` surfaces these. The **type** is the domain the error came from; the **code**
is the specific failure within that domain (for non-contract errors).

### Error types (\`SCErrorType\`)

${table(SC_ERROR_TYPES)}

### Error codes (\`SCErrorCode\`)

${table(SC_ERROR_CODES)}
`

if (check) {
  let current = ''
  try {
    current = readFileSync(outPath, 'utf8')
  } catch {
    /* missing → stale */
  }
  if (current !== page) {
    console.error('error-reference.md is out of date. Run `pnpm docs:errors` and commit.')
    process.exit(1)
  }
  console.log('error reference in sync')
} else {
  writeFileSync(outPath, page)
  console.log('generated packages/demo/content/api/error-reference.md')
}
