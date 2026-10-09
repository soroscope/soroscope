import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * Allowlist for rendered markdown. Content is repo-authored today, but
 * sanitizing keeps the pipeline safe if docs ever accept external input.
 * We preserve the tags markdown produces plus the heading `id`s and code
 * `class`es this renderer adds.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    code: ['class'],
    span: ['class'],
    pre: ['class'],
    div: ['class'],
    p: ['class'],
    a: ['href', 'name', 'target', 'rel'],
  },
}

/** GitHub-style alert labels → callout CSS modifier. */
const CALLOUT_KINDS: Record<string, string> = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'important',
  WARNING: 'warning',
  CAUTION: 'caution',
}

/**
 * Transform GitHub-style alerts (`> [!NOTE]`) — which `marked` renders as a
 * plain blockquote — into styled callout blocks.
 */
function renderCallouts(html: string): string {
  return html.replace(
    /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>)?\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
    (_m, kind: string, body: string) => {
      const mod = CALLOUT_KINDS[kind]
      const label = kind.charAt(0) + kind.slice(1).toLowerCase()
      return `<div class="callout callout-${mod}"><p class="callout-title">${label}</p><p>${body.trim()}</p></div>`
    },
  )
}

const contentDir = path.join(process.cwd(), 'content')

function slugify(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export type DocPage = {
  title: string
  description?: string
  content: string
  /** True for pages generated from source (no "edit on GitHub" affordance). */
  generated?: boolean
}

export async function getDocPage(slug: string[]): Promise<DocPage | null> {
  const filePath = path.join(contentDir, ...slug) + '.md'
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data: fm, content } = matter(raw)

  const rawHtml = marked.parse(content, { gfm: true }) as string

  // Inject id attributes into h2–h4 for TOC anchor links
  const withIds = rawHtml.replace(
    /<h([2-4])>(.*?)<\/h[2-4]>/g,
    (_match: string, level: string, inner: string) => {
      const id = slugify(inner)
      return `<h${level} id="${id}">${inner}</h${level}>`
    }
  )

  const html = sanitizeHtml(renderCallouts(withIds), SANITIZE_OPTIONS)

  return {
    title: (fm.title as string) || 'Untitled',
    description: fm.description as string | undefined,
    content: html,
    generated: fm.generated === true,
  }
}
