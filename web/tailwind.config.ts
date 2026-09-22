import type {Config} from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#000000",
          900: "#07090b",
          850: "#0c1013",
          800: "#161b21",
          700: "#232a33",
          600: "#39434f",
          500: "#647283",
          400: "#94a3b4",
          300: "#c6d1dc",
          200: "#e6ecf1",
          100: "#ffffff",
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
