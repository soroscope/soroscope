import type { Metadata } from 'next'
import Link from 'next/link'
import { probeProviders, publicProviderUrls } from '@soroscope/core'
import type { NetworkId, ProbeReport, ProviderProbe } from '@soroscope/core'

export const metadata: Metadata = {
  title: 'RPC provider status',
  description:
    'Live latency, ledger lag and retention of the public Stellar RPC providers Soroscope knows about.',
}

// Probing takes a few seconds per network. Serve a cached result and refresh it in the
// background, so the page is fast and public providers are not hit on every visit.
export const revalidate = 300
export const maxDuration = 60

type Result = { network: NetworkId; report: ProbeReport } | { network: NetworkId; error: string }

async function probe(network: NetworkId): Promise<Result> {
  try {
    // Reach is skipped here: it takes many lookups per provider. The CLI measures it.
    const report = await probeProviders(publicProviderUrls(network), { samples: 3, reach: false })
    return { network, report }
  } catch (err) {
    return { network, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

const STATUS_STYLE: Record<ProviderProbe['status'], string> = {
  healthy: 'text-accent',
  degraded: 'text-amber-300',
  unreachable: 'text-red-400',
  misconfigured: 'text-red-400',
}

const ms = (v: number | null): string => (v === null ? 'n/a' : `${Math.round(v)} ms`)
const days = (v: number | null): string => (v === null ? 'n/a' : v >= 10 ? `${Math.round(v)} d` : `${v.toFixed(1)} d`)

function NetworkTable({ result }: { result: Result }) {
  if ('error' in result) {
    return (
      <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
        The {result.network} providers could not be probed just now ({result.error}). This page retries on its next refresh.
      </p>
    )
  }
  const { report } = result
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Status of {result.network} RPC providers</caption>
        <thead className="bg-surface text-xs text-muted2">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Provider</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">p50</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">p95</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Ledger lag</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">History</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px] text-white/80">
          {report.providers.map((p) => (
            <tr key={p.provider} className="border-t border-white/[0.06]">
              <th scope="row" className="px-4 py-3 text-left font-normal text-white">{p.provider}</th>
              <td className={`px-4 py-3 ${STATUS_STYLE[p.status]}`}>{p.status}</td>
              <td className="px-4 py-3 text-right tabular-nums">{ms(p.latency.p50Ms)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{ms(p.latency.p95Ms)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{p.ledger.lag ?? 'n/a'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{days(p.ledger.advertisedDays)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function StatusPage() {
  const results = await Promise.all((['mainnet', 'testnet'] as const).map(probe))
  const checked = new Date().toISOString().replace('T', ' ').slice(0, 16)

  return (
    <main className="min-h-[100dvh] bg-bg text-text">
      <div className="mx-auto max-w-content px-6 py-16">
        <Link href="/docs/getting-started/introduction" className="text-sm text-muted2 transition-colors hover:text-white">
          Back to docs
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-white md:text-5xl" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
          RPC provider status
        </h1>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-white/60">
          Measured from this site&rsquo;s server, not from your browser. History is what each provider advertises;
          some serve <code className="font-mono text-[13px] text-white/80">getLedgers</code> much further back, which
          <code className="ml-1 font-mono text-[13px] text-white/80">soroscope probe</code> measures.
        </p>

        {results.map((result) => (
          <section key={result.network} className="mt-12" aria-labelledby={`h-${result.network}`}>
            <h2 id={`h-${result.network}`} className="mb-4 text-lg font-semibold capitalize text-white">
              {result.network}
            </h2>
            <NetworkTable result={result} />
          </section>
        ))}

        <p className="mt-10 text-sm text-muted2">
          Probed {checked} UTC. Refreshes at most every five minutes. Lag is how many ledgers a provider trails the best
          one in the same probe.{' '}
          <Link href="/docs/guides/rpc-provider-notes" className="text-accent underline-offset-4 hover:underline">
            What providers really do
          </Link>
        </p>
      </div>
    </main>
  )
}
