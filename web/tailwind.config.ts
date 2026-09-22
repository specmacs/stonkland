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
        /** The page. A rulebook is printed on stock, not displayed on a screen. */
        paper: "#f6efdd",
        paperCard: "#fffdf6",
        paperShade: "#eadfc4",
        /** Printed ink. */
        ink: "#14110a",
        inkMuted: "#5f574a",
        inkFaint: "#8f8675",
        /**
         * Four quarter hues, dark enough to carry white type at body size and separated
         * on lightness as well as hue, so they survive greyscale and the common forms of
         * colour blindness. These are meant to be used as whole fields, not as dots.
         */
        quarter: {
          1: "#164a9e",
          2: "#b04a06",
          3: "#146138",
          4: "#63278c",
        },
        /** The stamp. Used sparingly and always to mean something. */
        seal: "#bb2018",
        /** Flat fields the page is broken up with. */
        felt: "#1d5c4a",
        gold: "#e2a615",
        /**
         * Full-bleed section fields. The page changes colour between sections rather
         * than relying on whitespace to separate them.
         */
        field: {
          cream: "#f7f2e6",
          sky: "#bfe4ec",
          sun: "#f5c937",
          night: "#141414",
        },
        /**
         * Card tints. A row of cards is tinted across, which is what stops a grid of
         * panels reading as a spreadsheet.
         *
         * All six carry ink at body size with room to spare, so any of them can be used
         * as a card face without a second thought about contrast.
         */
        tint: {
          cream: "#fdf8ec",
          sun: "#fdf0c4",
          peach: "#fbdcc8",
          sky: "#d8e4fb",
          mint: "#cfeedd",
          lilac: "#e6dcf7",
        },
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
        cardLg: "8px 8px 0 0 #15120c",
        /* The same lift struck in colour, for a plate that has to carry a section. */
        cardSeal: "8px 8px 0 0 #bb2018",
        cardGold: "8px 8px 0 0 #e2a615",
      },
    },
  },
  plugins: [],
};

export default config;
