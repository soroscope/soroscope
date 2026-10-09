'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Progressive enhancement for rendered markdown: adds copy-to-clipboard buttons
 * to code blocks and hover anchor links to headings. Operates on the already
 * server-rendered `.doc-content` HTML, so it adds no cost to first paint.
 */
export default function DocEnhancements() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.querySelector('.doc-content')
    if (!root) return

    // Copy buttons on code blocks.
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'copy-btn'
      btn.textContent = 'Copy'
      btn.setAttribute('aria-label', 'Copy code to clipboard')
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
        void navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied'
          setTimeout(() => (btn.textContent = 'Copy'), 1500)
        })
      })
      pre.appendChild(btn)
    })

    // Hover anchor links on headings.
    root.querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id]').forEach((h) => {
      if (h.querySelector('.heading-anchor')) return
      const a = document.createElement('a')
      a.className = 'heading-anchor'
      a.href = `#${h.id}`
      a.setAttribute('aria-label', 'Link to this section')
      a.textContent = '#'
      h.appendChild(a)
    })
  }, [pathname])

  return null
}
