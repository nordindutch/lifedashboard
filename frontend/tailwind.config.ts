import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'codex-bg': '#0a0a0f',
        'codex-surface': '#12121a',
        'codex-border': '#27272f',
        'codex-accent': '#818cf8',
        'codex-muted': '#71717a',
      },
    },
  },
  plugins: [],
} satisfies Config;
