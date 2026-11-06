import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

/**
 * Picks the doc pages the assistant is shown for a question.
 *
 * Ranking is a small BM25-style score: each page is split into weighted fields (title, description,
 * headings, body), every question word is weighted by how rare it is across the docs, and a word
 * that appears many times in one page saturates instead of growing without bound. Raw word counts
 * (what this replaced) let common words such as "how" and "the" decide the ranking, so a long
 * generated reference page could beat the Installation page for "How do I install the CLI?".
 */

export type DocPage = {
  title: string;
  href: string;
  body: string;
  /** Weighted term frequencies, built once. */
  terms: Map<string, number>;
};

const STOPWORDS = new Set(
  (
    'a an and are as at be but by can do does for from has have how i if in into is it its me my of on or ' +
    'our so than that the their then there these they this to up was we what when where which who why will ' +
    'with would you your use using used get got should could about any all also not no yes via per show tell ' +
    'give make need want like just soroscope'
  ).split(' '),
);

/** Crude stemming: enough to make "install", "installing" and "installation" meet. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  const s = w.replace(/(ations?|ings?|ers?|ed|es|s)$/, '');
  return s.length >= 4 ? s : w;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

const FIELD_WEIGHT = { title: 6, description: 3, headings: 4, body: 1 } as const;

function addField(terms: Map<string, number>, text: string, weight: number) {
  for (const t of tokens(text)) terms.set(t, (terms.get(t) ?? 0) + weight);
}

export function loadPages(contentDir: string, items: { title: string; href: string }[]): DocPage[] {
  const pages: DocPage[] = [];
  for (const item of items) {
    const slug = item.href.replace('/docs/', '').split('/');
    const filePath = path.join(contentDir, ...slug) + '.md';
    if (!fs.existsSync(filePath)) continue;
    const { data: fm, content } = matter(fs.readFileSync(filePath, 'utf-8'));
    const title = (fm.title as string) || item.title;
    const headings = [...content.matchAll(/^#{2,4}\s+(.+)$/gm)].map((m) => m[1]).join('\n');
    const terms = new Map<string, number>();
    addField(terms, title, FIELD_WEIGHT.title);
    addField(terms, (fm.description as string) ?? '', FIELD_WEIGHT.description);
    addField(terms, headings, FIELD_WEIGHT.headings);
    addField(terms, content, FIELD_WEIGHT.body);
    pages.push({ title, href: item.href, body: content, terms });
  }
  return pages;
}

/** The generated API reference is 160 near-identical pages; prefer the hand-written ones. */
const prior = (href: string) => (href.startsWith('/docs/reference/') ? 0.5 : 1);

export function rank(pages: DocPage[], question: string, limit: number): DocPage[] {
  const wanted = [...new Set(tokens(question))];
  const n = pages.length;
  const df = new Map<string, number>();
  for (const t of wanted) df.set(t, pages.filter((p) => p.terms.has(t)).length);

  const scored = pages.map((p) => {
    let score = 0;
    for (const t of wanted) {
      const tf = p.terms.get(t) ?? 0;
      if (tf === 0) continue;
      const d = df.get(t) ?? 0;
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
      score += idf * (tf / (tf + 2));
    }
    return { page: p, score: score * prior(p.href) };
  });

  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (matched.length > 0) return matched.slice(0, limit).map((s) => s.page);
  return pages.filter((p) => p.href.includes('getting-started')).slice(0, limit);
}
