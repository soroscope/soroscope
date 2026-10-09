import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#080808',
        surface:  '#111111',
        surface2: '#1a1a1a',
        accent:   '#e8ff47',
        muted:    '#555555',
        muted2:   '#888888',
        text:     '#f2f2f2',
      },
      fontFamily: {
        heading: ['var(--font-instrument-serif)', 'serif'],
        sans:    ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        content: '1080px',
      },
    },
  },
  plugins: [],
}

export default config
