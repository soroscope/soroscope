#!/usr/bin/env node
/**
 * Single source of truth for documentation.
 *
 * The docs-site content under `packages/demo/content/api/*.md` is canonical
 * (it carries frontmatter + descriptions and is what the website renders).
 * The repo-root `docs/*.md` files — linked from the READMEs and rendered on
 * GitHub — are GENERATED from it: frontmatter is dropped, an H1 is added from
 * the title, and site-absolute links are rewritten to relative `.md` links.
 *
 *   node scripts/sync-docs.mjs           # regenerate docs/*.md
 *   node scripts/sync-docs.mjs --check   # fail if docs/*.md are out of date
 *
 * Edit the content/ files, never the generated docs/ files.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'packages/demo/content/api')
const outDir = join(root, 'docs')
const check = process.argv.includes('--check')

/** Parse `--- yaml ---` frontmatter; returns { title, body }. */
function parse(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { title: null, body: raw }
  const title = (m[1].match(/^title:\s*(.+)$/m) || [])[1]?.trim()
  return { title, body: raw.slice(m[0].length).replace(/^\n+/, '') }
}

/** Rewrite site-absolute doc links to relative .md links for GitHub. */
function rewriteLinks(body) {
  return body.replace(/\]\(\/docs\/api\/([a-z0-9-]+)\)/g, '](./$1.md)')
}

function generate(slug, raw) {
  const { title, body } = parse(raw)
  const heading = title ?? slug
  const banner =
    `<!-- Generated from packages/demo/content/api/${slug}.md by scripts/sync-docs.mjs. ` +
    `Do not edit directly; run \`pnpm docs:sync\`. -->\n\n`
  return `${banner}# ${heading}\n\n${rewriteLinks(body).trimEnd()}\n`
}

let stale = []
for (const file of readdirSync(contentDir).filter((f) => f.endsWith('.md'))) {
  const slug = file.replace(/\.md$/, '')
  const raw = readFileSync(join(contentDir, file), 'utf8')

  // Skip pages that are themselves generated from another source (e.g. the
  // error reference, generated from codes.ts) — they are site-only.
  if (/^generated:\s*true\s*$/m.test(raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '')) continue

  const generated = generate(slug, raw)
  const outPath = join(outDir, file)

  if (check) {
    let current = ''
    try {
      current = readFileSync(outPath, 'utf8')
    } catch {
      /* missing → stale */
    }
    if (current !== generated) stale.push(`docs/${file}`)
  } else {
    writeFileSync(outPath, generated)
    console.log(`generated docs/${file}`)
  }
}

if (check && stale.length) {
  console.error(
    `docs/ is out of sync with content/:\n  ${stale.join('\n  ')}\n` +
      `Run \`pnpm docs:sync\` and commit the result.`,
  )
  process.exit(1)
}
