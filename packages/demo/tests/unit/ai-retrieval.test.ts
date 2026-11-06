import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allDocPages } from '../../lib/docroutes';
import { loadPages, rank, stem, tokens } from '../../lib/ai-retrieval';

// The real documentation, not a stand-in: what the assistant retrieves from is what ships.
const pages = loadPages(path.join(__dirname, '../../content'), allDocPages);
const top = (q: string, n = 3) => rank(pages, q, n).map((p) => p.href);

describe('tokenising', () => {
  it('drops words that say nothing about the topic and stems related forms together', () => {
    expect(tokens('How do I install the CLI?')).toEqual(['install', 'cli']);
    expect(stem('installation')).toBe(stem('installing'));
    expect(stem('installation')).toBe(stem('install'));
  });
});

describe('retrieval over the real docs', () => {
  it('finds the Installation page for the question that failed in production', () => {
    // Raw word counts ranked this question by "how" and "the", and missed the page.
    expect(top('How do I install the CLI?')).toContain('/docs/getting-started/installation');
  });

  it.each([
    [
      'What happens when my contract fails to compile in soroscope dev?',
      '/docs/guides/local-development',
    ],
    ['How do I run a contract locally and hot swap it on save?', '/docs/guides/local-development'],
    ['How do I test against live mainnet state offline?', '/docs/guides/fork-testing'],
    ['Do all RPC providers give the same simulation answer?', '/docs/guides/comparing-providers'],
    [
      'How do I fail a pull request when a call gets more expensive?',
      '/docs/guides/ci-resource-checks',
    ],
    ['What can the MCP server not do?', '/docs/guides/mcp-server'],
    ['Why would the router refuse to send a request?', '/docs/guides/rpc-routing'],
  ])('%s', (question, expected) => {
    expect(top(question)).toContain(expected);
  });

  it('prefers a hand-written guide over the generated reference for a how-to question', () => {
    expect(top('how do I simulate a contract call', 1)[0]).not.toMatch(/^\/docs\/reference\//);
  });

  it('falls back to getting started when nothing matches', () => {
    for (const href of top('zzzzqqqq xxxyyyy')) expect(href).toContain('getting-started');
  });
});
