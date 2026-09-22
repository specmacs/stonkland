import type {Config} from "tailwindcss";

/**
 * A board game printed on paper, not a dashboard.
 *
 * Cream cards sit on a coloured tabletop, everything is bounded by a heavy ink rule
 * rather than a hairline, and the type is large enough to read across a table. Numbers
 * are set in a mono face because on most of these pages the number is the argument.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** The surface the board is laid out on. */
        tabletop: "#c9ddd4",
        tabletopDeep: "#a8c4b8",
        /** Card and panel stock. */
        paper: "#fdfaf2",
        paperShade: "#f3ecdc",
        paperEdge: "#e4d9c2",
        /** Printed ink. */
        ink: "#15120c",
        inkMuted: "#6b6356",
        inkFaint: "#9a9183",
        /** Four quarter hues. Separated on lightness as well as hue, so they survive
         *  greyscale and the common forms of colour blindness on a cream ground. */
        quarter: {
          1: "#1c63c9",
          2: "#d96a0b",
          3: "#15803d",
          4: "#8b3fb5",
        },
        /** The one accent that is not a quarter. */
        seal: "#c8161d",
        gold: "#e0a92b",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        /* Fluid, so a headline fills a phone and a desktop equally well. */
        "display-xl": ["clamp(3.6rem, 8vw, 7rem)", {lineHeight: "0.92", letterSpacing: "-0.03em"}],
        "display-lg": ["clamp(2.6rem, 5vw, 4.6rem)", {lineHeight: "0.95", letterSpacing: "-0.025em"}],
        "display-md": ["clamp(2rem, 3.4vw, 3.1rem)", {lineHeight: "1", letterSpacing: "-0.02em"}],
        "stat": ["clamp(2.2rem, 3.4vw, 3.4rem)", {lineHeight: "1", letterSpacing: "-0.02em"}],
        "body-lg": ["clamp(1.05rem, 1.3vw, 1.2rem)", {lineHeight: "1.6"}],
      },
      borderWidth: {
        rule: "2px",
      },
      boxShadow: {
        /* A card lifted off the table, not a glow. */
        card: "4px 4px 0 0 #15120c",
        cardSm: "2px 2px 0 0 #15120c",
      },
    },
  },
  plugins: [],
};

export default config;
