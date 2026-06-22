import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        "surface-0": "var(--surface-0)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        gold: {
          DEFAULT: "var(--gold)",
          hover: "var(--gold-hover)",
          deep: "var(--gold-deep)",
          soft: "var(--gold-soft)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          subtle: "var(--ink-subtle)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        pill: "var(--radius-pill)",
      },
      maxWidth: {
        content: "var(--container-max)",
        narrow: "clamp(320px, 88vw, 720px)",
      },
      spacing: {
        section: "var(--section-pad)",
        gutter: "var(--gutter)",
        nav: "var(--nav-height)",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out)",
      },
      zIndex: {
        bg: "0",
        content: "3",
        nav: "40",
        overlay: "50",
        modal: "60",
      },
    },
  },
  plugins: [],
};

export default config;
