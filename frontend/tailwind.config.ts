import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        // ── Semantic design tokens (CSS vars defined in index.css) ──────────
        page:    'rgb(var(--c-page)    / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--c-surface)   / <alpha-value>)',
          2:       'rgb(var(--c-surface-2) / <alpha-value>)',
          3:       'rgb(var(--c-surface-3) / <alpha-value>)',
        },
        edge: {
          DEFAULT: 'rgb(var(--c-edge)   / <alpha-value>)',
          2:       'rgb(var(--c-edge-2) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--c-content)       / <alpha-value>)',
          2:       'rgb(var(--c-content-2)      / <alpha-value>)',
          muted:   'rgb(var(--c-content-muted)  / <alpha-value>)',
          subtle:  'rgb(var(--c-content-subtle) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
