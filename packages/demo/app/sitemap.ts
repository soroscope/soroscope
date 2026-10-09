import type { MetadataRoute } from 'next'
import { allDocPages } from '@/lib/docroutes'
import { siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return allDocPages.map((page) => ({
    url: `${siteUrl}${page.href}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))
}
