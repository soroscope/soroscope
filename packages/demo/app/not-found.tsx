import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-6 text-center">
      <p className="text-accent text-sm font-mono mb-4">404</p>
      <h1
        className="text-4xl font-bold text-white mb-3"
        style={{ fontFamily: 'var(--font-instrument-serif)' }}
      >
        Page not found
      </h1>
      <p className="text-white/45 max-w-md mb-8">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <Link
        href="/docs/getting-started/introduction"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        Back to docs
      </Link>
    </main>
  )
}
