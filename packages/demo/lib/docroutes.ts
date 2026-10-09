export type DocItem = {
  title: string
  href: string
}

export type DocSection = {
  title: string
  items: DocItem[]
}

import { referenceItems } from './reference-routes'

export const docSections: DocSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', href: '/docs/getting-started/introduction' },
      { title: 'Installation', href: '/docs/getting-started/installation' },
      { title: 'Quick Start', href: '/docs/getting-started/quick-start' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'What RPC Providers Really Do', href: '/docs/guides/rpc-provider-notes' },
      { title: 'Retention-aware Routing', href: '/docs/guides/rpc-routing' },
      { title: 'Simulating Contract Calls', href: '/docs/guides/simulating-calls' },
      { title: 'Contract Errors & Failed Calls', href: '/docs/guides/contract-errors' },
      { title: 'CI Resource Checks', href: '/docs/guides/ci-resource-checks' },
      { title: 'MCP Server', href: '/docs/guides/mcp-server' },
      { title: 'Command Line', href: '/docs/guides/cli' },
      { title: 'Networks', href: '/docs/guides/networks' },
      { title: 'Stability & Versioning', href: '/docs/guides/versioning' },
    ],
  },
  {
    title: 'Modules',
    items: [
      { title: 'SoroscopeRouter', href: '/docs/api/router' },
      { title: 'Probing Providers', href: '/docs/api/probe' },
      { title: 'XDR Decoders', href: '/docs/api/decoders' },
      { title: 'Contract Specs', href: '/docs/api/contract-specs' },
      { title: '@soroscope/invoke', href: '/docs/api/invoke' },
      { title: 'CI Config Reference', href: '/docs/api/ci-config' },
      { title: 'Error Reference', href: '/docs/api/error-reference' },
    ],
  },
  {
    title: 'API Reference',
    items: referenceItems,
  },
]

export const allDocPages: DocItem[] = docSections.flatMap((s) => s.items)
