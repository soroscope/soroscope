'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-6 text-center">
      <p className="text-accent text-sm font-mono mb-4">Something went wrong</p>
      <h1
        className="text-4xl font-bold text-white mb-3"
        style={{ fontFamily: 'var(--font-instrument-serif)' }}
      >
        Unexpected error
      </h1>
      <p className="text-white/45 max-w-md mb-8">
        An error occurred while rendering this page. Try again, and if the problem persists
        please open an issue.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </main>
  )
}
