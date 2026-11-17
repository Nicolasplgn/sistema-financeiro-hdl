/** @type {import('tailwindcss').Config} */
export default {
  // O tema escuro é ligado pelo atributo data-theme="dark" no <html> (hook useTheme)
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--canvas)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        brand: { DEFAULT: 'var(--brand)', hover: 'var(--brand-hover)', soft: 'var(--brand-soft)', ink: 'var(--brand-ink)' },
        pos: { DEFAULT: 'var(--pos)', soft: 'var(--pos-soft)' },
        neg: { DEFAULT: 'var(--neg)', soft: 'var(--neg-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        cell: { input: 'var(--cell-input)', line: 'var(--cell-input-line)' },
        sidebar: { DEFAULT: 'var(--sidebar)', ink: 'var(--sidebar-ink)', 'ink-2': 'var(--sidebar-ink-2)', active: 'var(--sidebar-active)' },
      },
      boxShadow: {
        card: 'var(--shadow)',
        pop: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
