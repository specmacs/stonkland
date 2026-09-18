import type {Config} from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080a0c",
          900: "#0d1117",
          850: "#12181f",
          800: "#1a222c",
          700: "#273241",
          600: "#3a4859",
          500: "#5b6b7e",
          400: "#8496a9",
          300: "#b4c2d0",
          200: "#d8e0e8",
          100: "#eef2f6",
        },
        brass: {
          500: "#c8a24a",
          400: "#dbb864",
          300: "#e8ce8e",
        },
        // Four quarter hues, checked against deuteranopia and protanopia simulation:
        // they separate on lightness as well as hue, so they stay distinguishable in
        // greyscale and to the most common forms of colour blindness.
        quarter: {
          1: "#4a8fd4",
          2: "#d98b3a",
          3: "#5fa86b",
          4: "#a774c4",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
