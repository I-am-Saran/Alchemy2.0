const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        /* Copper color palette (subtle version) - refined blues, muted cyan with warm copper/gold accents */
        /* Source: https://www.color-hex.com/color-palette/4753 (browser color removed, subtle versions) */
        primary: '#2d5a8f',        // SOFT BLUE - Subtle muted blue (primary dark)
        secondary: '#5a9ba8',      // MUTED CYAN - Subtle cyan (primary accent)
        accent: '#5a9ba8',         // MUTED CYAN - Secondary accent (replaces teal)
        gold: '#b8945a',           // SOFT GOLD - Subtle warm accent/highlight
        copper: '#8b6b4a',         // MUTED COPPER - Subtle text/primary dark
        background: '#F8F9FA',     // Light neutral - Base page background
        card: '#FFFFFF',           // White - Card surface
        text: '#8b6b4a',           // MUTED COPPER - Subtle copper brown for readable body copy
        primaryHover: '#1d4a6f',   // Darker subtle blue for hover states
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      },
    }
  },
  plugins: []
});