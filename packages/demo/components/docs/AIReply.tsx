'use client';

import { useEffect, useRef } from 'react';

/**
 * Renders an assistant reply (server-sanitized HTML, see lib/ai-markdown.ts) and puts a Copy
 * button on every code block, so a command can be taken without selecting it by hand.
 *
 * The buttons are added to the DOM after render instead of coming from the server, because the
 * sanitizer allows no <button>: the HTML the model can influence has no interactive elements.
 */
export default function AIReply({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const timers: number[] = [];
    const cleanups: (() => void)[] = [];

    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('ai-code')) return;
      // The button sits on a wrapper, not inside the <pre>: a long line scrolls the <pre>, and a
      // button inside it would scroll away (or be clipped) with the text.
      const wrap = document.createElement('div');
      wrap.className = 'ai-code';
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-copy';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');

      const onClick = async () => {
        const text = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copied';
        } catch {
          // No clipboard access (insecure context, permission denied): say so rather than lie.
          btn.textContent = 'Copy failed';
        }
        timers.push(window.setTimeout(() => (btn.textContent = 'Copy'), 1500));
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
      wrap.appendChild(btn);
    });

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cleanups.forEach((c) => c());
    };
  }, [html]);

  // The HTML is the output of renderReply(): rendered from markdown and passed through a strict
  // allowlist (tested against script, handler, javascript:, data: and iframe payloads).
  return <div ref={ref} className="ai-reply" dangerouslySetInnerHTML={{ __html: html }} />;
}
