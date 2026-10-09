import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { allDocPages } from '@/lib/docroutes';

/**
 * Docs assistant backed by the Groq chat-completions API.
 *
 * The route is honest by design: without a GROQ_API_KEY it returns 503 and
 * the panel tells the user the assistant is not configured — it never fakes
 * an answer. Replies are grounded in the markdown under content/, selected
 * per-request by a simple keyword score over the last user message.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const MAX_TURNS = 8;
const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_PAGES = 3;
const MAX_PAGE_CHARS = 4000;
const UPSTREAM_TIMEOUT_MS = 20_000;

// Best-effort per-instance rate limit; serverless instances each get their
// own bucket, so this bounds abuse per warm instance rather than globally.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const messages: ChatMessage[] = [];
  for (const entry of raw.slice(-MAX_TURNS)) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string' || content.trim().length === 0) return null;
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }

  if (messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

const contentDir = path.join(process.cwd(), 'content');

type ScoredPage = { title: string; href: string; body: string; score: number };

/** Pick the doc pages most relevant to the question by keyword frequency. */
function relevantPages(question: string): ScoredPage[] {
  const terms = [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2),
    ),
  ];

  const pages: ScoredPage[] = [];
  for (const item of allDocPages) {
    const slug = item.href.replace('/docs/', '').split('/');
    const filePath = path.join(contentDir, ...slug) + '.md';
    if (!fs.existsSync(filePath)) continue;

    const { data: fm, content } = matter(fs.readFileSync(filePath, 'utf-8'));
    const title = ((fm.title as string) || item.title).toLowerCase();
    const lower = content.toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      score += lower.split(term).length - 1;
    }
    pages.push({
      title: (fm.title as string) || item.title,
      href: item.href,
      body: content,
      score,
    });
  }

  const matched = pages.filter((p) => p.score > 0).sort((a, b) => b.score - a.score);
  const chosen =
    matched.length > 0 ? matched : pages.filter((p) => p.href.includes('getting-started'));
  return chosen.slice(0, MAX_CONTEXT_PAGES);
}

function systemPrompt(pages: ScoredPage[]): string {
  const context = pages
    .map((p) => `--- ${p.title} (${p.href}) ---\n${p.body.slice(0, MAX_PAGE_CHARS)}`)
    .join('\n\n');

  return [
    'You are the docs assistant for Soroscope, developer tooling for Stellar and Soroban',
    '(retention-aware RPC routing and health checks, XDR decoding, simulation, CI resource',
    'checks, and an MCP server).',
    'Answer ONLY from the documentation excerpts below. If the excerpts do not cover the',
    'question, say so and suggest the closest doc page instead of guessing.',
    'Reply in plain text without markdown formatting, in at most 120 words.',
    'When you reference a doc page, name it by its title.',
    '',
    context,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'The AI assistant is not configured on this deployment.' },
      { status: 503 },
    );
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests — please wait a minute and try again.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json(
      {
        error:
          'Expected { messages: [{ role: "user" | "assistant", content: string }] } ending with a user message.',
      },
      { status: 400 },
    );
  }

  const question = messages[messages.length - 1].content;

  try {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [{ role: 'system', content: systemPrompt(relevantPages(question)) }, ...messages],
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'The AI service returned an error — please try again shortly.' },
        { status: 502 },
      );
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: 'The AI service returned an empty reply — please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the AI service — please try again shortly.' },
      { status: 504 },
    );
  }
}
