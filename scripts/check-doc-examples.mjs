#!/usr/bin/env node
/**
 * Guards documentation examples against API drift.
 *
 * Scans every ```ts / ```typescript code block in the docs for named imports from
 * a Soroscope package (`@soroscope/core`, `@soroscope/ci`, ...) and verifies each
 * imported symbol is really exported by that package. Exports are resolved with the
 * TypeScript compiler, so `export * from` is followed. If a package renames or removes
 * an export, the docs fail CI instead of silently shipping a broken example.
 *
 *   pnpm docs:test
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'packages/demo/content')

/** Published packages whose imports the docs may show. */
const PACKAGES = {
  '@soroscope/core': 'packages/core',
  '@soroscope/invoke': 'packages/invoke',
  '@soroscope/ci': 'packages/ci',
  '@soroscope/mcp': 'packages/mcp',
  '@soroscope/cli': 'packages/cli',
}

/** Every exported name (values and types) of a package's entry point. */
function exportsOf(dir) {
  const configPath = join(root, dir, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, join(root, dir))
  const entry = join(root, dir, 'src/index.ts')
  const program = ts.createProgram([entry], { ...parsed.options, noEmit: true })
  const checker = program.getTypeChecker()
  const file = program.getSourceFile(entry)
  const moduleSymbol = file && checker.getSymbolAtLocation(file)
  return new Set(moduleSymbol ? checker.getExportsOfModule(moduleSymbol).map((s) => s.name) : [])
}

/** Recursively list .md files. */
function mdFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry)
    return statSync(p).isDirectory() ? mdFiles(p) : p.endsWith('.md') ? [p] : []
  })
}

const exported = Object.fromEntries(Object.entries(PACKAGES).map(([name, dir]) => [name, exportsOf(dir)]))
const violations = []
let blocks = 0
let imports = 0

for (const file of mdFiles(contentDir)) {
  const md = readFileSync(file, 'utf8')
  const rel = file.slice(root.length + 1)

  for (const fence of md.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)) {
    blocks++
    for (const imp of fence[1].matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@soroscope\/[a-z-]+)['"]/g,
    )) {
      const pkg = imp[2]
      const names = exported[pkg]
      if (!names) {
        violations.push(`${rel}: imports from unknown package "${pkg}"`)
        continue
      }
      for (const part of imp[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (!name) continue
        imports++
        if (!names.has(name)) violations.push(`${rel}: imports "${name}" which is not exported by ${pkg}`)
      }
    }
  }
}

const total = Object.values(exported).reduce((n, s) => n + s.size, 0)
console.log(`docs:test — scanned ${blocks} code block(s), verified ${imports} import(s) against ${total} exports`)

if (violations.length) {
  console.error(`\n${violations.length} broken reference(s):\n  ${violations.join('\n  ')}`)
  process.exit(1)
}
console.log('All documented imports resolve to real exports.')
