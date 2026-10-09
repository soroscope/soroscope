# Soroscope Docs Site

Next.js 16 documentation site for the [`@soroscope/core`](../sdk) SDK: rendered
markdown docs, full-text search, and an optional AI docs assistant.

## Structure

- `content/` — markdown source for every docs page (getting started, guides,
  module docs, generated API reference)
- `app/docs/[[...slug]]` — docs pages rendered from `content/` via `lib/docs.ts`
  (marked + sanitize-html)
- `app/api/docs/search` — keyword search over `content/*.md`
- `app/api/ai` — docs assistant backed by the Groq API, grounded in `content/`
- `components/docs/` — navbar, sidebar, table of contents, search dialog,
  AI panel

## Development

```sh
pnpm install
pnpm --filter @soroscope/demo dev
```

## Environment

The AI assistant is optional. Without a key the panel reports that the
assistant is not configured — everything else works normally.

| Variable       | Required | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| `GROQ_API_KEY` | No       | Groq API key; enables `/api/ai`                   |
| `GROQ_MODEL`   | No       | Groq model id (default `llama-3.3-70b-versatile`) |

Copy `.env.example` to `.env.local` and fill in values.

## Deployment

Deployed on Vercel. `next.config.js` traces `content/**/*.md` into the
search and AI serverless functions — keep that in sync if routes move.
