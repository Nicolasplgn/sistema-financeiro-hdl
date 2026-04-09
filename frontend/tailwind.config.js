/** @type {import('tailwindcss').Config} */
module.exports = {
  // Diz ao Tailwind que o modo escuro é acionado pelo hook (data-theme="dark")
  darkMode:['class', '[data-theme="dark"]'], 
  content:[
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Conecta o Tailwind às suas variáveis de CSS
      colors: {
        // Superfícies
        base: 'var(--bg-base)',
        card: 'var(--bg-card)',
        sidebar: 'var(--bg-sidebar)',
        hover: 'var(--bg-hover)',
        input: 'var(--bg-input)',
        
        // Bordas
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        
        // Textos
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        inverse: 'var(--text-inverse)',
        
        // Marca
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
        },
        
        // Semânticas
        positive: 'var(--color-positive)',
        negative: 'var(--color-negative)',
        warning: 'var(--color-warning)',
        neutral: 'var(--color-neutral)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lg: 'var(--shadow-lg)',
      }
    },
  },
  plugins:[],
}