import { describe, expect, it } from 'vitest';
import { renderReply } from '../../lib/ai-markdown';

describe('renderReply', () => {
  it('renders the formatting the assistant actually produced', () => {
    // The reply a user reported as showing raw asterisks, backticks and a fence.
    const html = renderReply(
      'Install the CLI globally:\n\n```sh\nnpm install --global @soroscope/cli\nsoroscope probe --network testnet\n```\n\nOr run `npx @soroscope/cli probe`. See the **Installation** doc page.',
    );
    expect(html).toContain('<strong>Installation</strong>');
    expect(html).toContain('<code>npx @soroscope/cli probe</code>');
    expect(html).toContain('<pre><code class="language-sh">');
    expect(html).toContain(
      'npm install --global @soroscope/cli\nsoroscope probe --network testnet',
    );
    expect(html).not.toContain('**');
    expect(html).not.toContain('```');
  });

  it('renders lists and emphasis', () => {
    const html = renderReply('1. Open a terminal\n2. Run `soroscope dev`\n\n- *fast*\n- ~~slow~~');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>Run <code>soroscope dev</code></li>');
    expect(html).toContain('<em>fast</em>');
    expect(html).toContain('<del>slow</del>');
  });

  it('opens external links safely and leaves docs links relative', () => {
    const html = renderReply('[Groq](https://console.groq.com/docs) and [guide](/docs/guides/cli)');
    expect(html).toContain('href="https://console.groq.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<a href="/docs/guides/cli">guide</a>');
  });

  it('strips script, event handlers and dangerous links from untrusted model output', () => {
    const html = renderReply(
      [
        '<script>alert(1)</script>',
        '<img src=x onerror="alert(2)">',
        '<a href="javascript:alert(3)" onclick="alert(4)">click</a>',
        '[data](data:text/html;base64,PHNjcmlwdD4=)',
        '<iframe src="https://evil.example"></iframe>',
        '<div style="position:fixed" onmouseover="alert(5)">overlay</div>',
        '<code class="language-sh onload=alert(6)">x</code>',
      ].join('\n\n'),
    );
    for (const bad of [
      '<script',
      'onerror',
      'javascript:',
      'onclick',
      'data:text',
      '<iframe',
      'style=',
      'onmouseover',
      'onload',
      '<img',
    ]) {
      expect(html.toLowerCase()).not.toContain(bad);
    }
    // The text of what was dropped is kept, so a visitor still sees an answer.
    expect(html).toContain('click');
    expect(html).toContain('overlay');
  });

  it('escapes angle brackets that are text, not markup', () => {
    expect(renderReply('Use `a < b` and Vec<u8>')).toContain('a &lt; b');
  });
});
