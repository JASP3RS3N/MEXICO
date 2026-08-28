/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutrals are CSS variables so they can be themed at runtime (Settings).
        background: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        surface3: "rgb(var(--c-surface3) / <alpha-value>)",
        sidebar: "rgb(var(--c-sidebar) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        borderHover: "rgb(var(--c-borderhover) / <alpha-value>)",
        textMain: "rgb(var(--c-textmain) / <alpha-value>)",
        textDim: "rgb(var(--c-textdim) / <alpha-value>)",
        textBright: "rgb(var(--c-textbright) / <alpha-value>)",
        money: "rgb(var(--c-money) / <alpha-value>)",
        // Accents stay fixed.
        cyan: {
          DEFAULT: "#00e5a0",
          dim: "rgba(0,229,160,0.1)",
          glow: "rgba(0,229,160,0.25)"
        },
        blue: {
          DEFAULT: "#0ea5e9",
          dim: "rgba(14,165,233,0.1)"
        },
      },
      fontFamily: {
        display: ['Literata', 'Georgia', 'serif'],
        body: ['"Instrument Sans"', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        // Pulso del tablero de almacén: una solicitud en rojo late para que se
        // note de reojo desde el piso, sin llegar a un parpadeo agresivo.
        'pulse-alert': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
          '50%': { opacity: '0.92', boxShadow: '0 0 0 12px rgba(239,68,68,0)' },
        },
      },
      animation: {
        'pulse-alert': 'pulse-alert 1.6s ease-in-out infinite',
      },
      backgroundImage: {
        'grad-main': 'linear-gradient(135deg, #00e5a0 0%, #0ea5e9 100%)',
        'grad-purple': 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
        'grad-amber': 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
        'grad-red': 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
      }
    },
  },
  plugins: [],
}
