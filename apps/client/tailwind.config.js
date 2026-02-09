/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      textColor: {
        skin: {
          base: 'rgb(var(--color-text-base) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          inverted: 'rgb(var(--color-text-inverted) / <alpha-value>)',
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
          danger: 'rgb(var(--color-danger) / <alpha-value>)',
        },
      },
      backgroundColor: {
        skin: {
          fill: 'rgb(var(--color-fill) / <alpha-value>)',
          surface: 'rgb(var(--color-surface) / <alpha-value>)',
          'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
          danger: 'rgb(var(--color-danger) / <alpha-value>)',
        },
      },
      borderColor: {
        skin: {
          base: 'rgb(var(--color-border) / <alpha-value>)',
          active: 'rgb(var(--color-border-active) / <alpha-value>)',
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
        },
      },
      ringColor: {
        skin: {
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
        },
      },
      fontFamily: {
        // Keep standard sans for UI, but maybe add a mono for "data"
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}