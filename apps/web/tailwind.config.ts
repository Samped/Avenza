import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        black: "#0a0a0a",
        white: "#FFFFFF",
        ink: "#0a0a0a",
        paper: "#f7f7f7",
        mute: "#737373",
        line: "#e5e5e5",
        soft: "#f0f0f0",
        pine: "#0a0a0a",
        pineSoft: "#f5f5f5",
      },
      fontFamily: {
        display: ["var(--font-display)", "Syne", "sans-serif"],
        sans: ["var(--font-sans)", "DM Sans", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        lift: "none",
        focus: "0 0 0 2px #fff, 0 0 0 4px #0a0a0a",
      },
    },
  },
  plugins: [],
};

export default config;
