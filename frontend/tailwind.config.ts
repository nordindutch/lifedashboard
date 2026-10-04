import type { Config } from 'tailwindcss';

/**
 * Design tokens (bron: stijlgids Budget). CSS-variabelen staan in src/index.css zodat
 * dezelfde waarden ook buiten Tailwind (inline SVG, recharts) bruikbaar zijn.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      // Stijlgids: onder 720 px de mobiele indeling met tabbalk, erboven een zijbalk.
      md: '720px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        codex: {
          bg: 'var(--codex-bg)',
          surface: 'var(--codex-surface)',
          'surface-2': 'var(--codex-surface-2)',
          border: 'var(--codex-border)',
          'border-soft': 'var(--codex-border-soft)',
          accent: 'var(--codex-accent)',
          'accent-ink': 'var(--codex-accent-ink)',
          positive: 'var(--codex-positive)',
          risk: 'var(--codex-risk)',
          'risk-bg': 'var(--codex-risk-bg)',
          'risk-border': 'var(--codex-risk-border)',
          text: 'var(--codex-text)',
          muted: 'var(--codex-muted)',
          'muted-2': 'var(--codex-muted-2)',
        },
        // Oude aliassen blijven werken voor bestaande pagina's.
        'codex-bg': 'var(--codex-bg)',
        'codex-surface': 'var(--codex-surface)',
        'codex-border': 'var(--codex-border)',
        'codex-accent': 'var(--codex-accent)',
        'codex-muted': 'var(--codex-muted)',
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        field: '14px',
        sheet: '24px',
      },
      minHeight: {
        touch: '44px',
        row: '56px',
      },
      minWidth: {
        touch: '44px',
      },
      spacing: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config;
