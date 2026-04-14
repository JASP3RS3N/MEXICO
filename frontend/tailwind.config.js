/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        surface: "#0d1420",
        surface2: "#121c2c",
        surface3: "#1a2840",
        border: "#1e3050",
        borderHover: "#2e4a72",
        cyan: {
          DEFAULT: "#00e5a0",
          dim: "rgba(0,229,160,0.1)",
          glow: "rgba(0,229,160,0.25)"
        },
        blue: {
          DEFAULT: "#0ea5e9",
          dim: "rgba(14,165,233,0.1)"
        },
        textMain: "#b8c5d3",
        textDim: "#5a6d82",
        textBright: "#e8edf2"
      },
      fontFamily: {
        display: ['Literata', 'Georgia', 'serif'],
        body: ['"Instrument Sans"', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
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
