import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Turns the docs assistant's markdown reply into HTML that is safe to inject into the page.
 *
 * The reply is model output, so it is untrusted: a page the model was shown, or a user's own
 * question, can steer it into writing a script tag, an event handler or a javascript: link.
 * Everything is therefore passed through a strict allowlist after rendering. Only the formatting a
 * short answer needs survives (paragraphs, bold, italics, code, lists, quotes, links); anything
 * else is dropped and its text kept.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'h3',
    'h4',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    code: ['class'],
  },
  // Only the language-xxx class that markdown puts on a fenced block.
  allowedClasses: { code: [/^language-[a-z0-9+#-]+$/i] },
  // Relative links (/docs/...) are allowed; javascript:, data: and the rest are not.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? '');
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      };
    },
  },
};

export function renderReply(markdown: string): string {
  const html = marked.parse(markdown, { gfm: true, breaks: true, async: false }) as string;
  return sanitizeHtml(html, OPTIONS);
}
