/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [
    require('@pecking-order/ui-kit/tailwind-preset'),
  ],
  theme: {
    extend: {
      // App-specific extensions go here.
      // All shared tokens (colors, fonts, radii, animations) come from the preset.
    },
  },
  plugins: [],
}