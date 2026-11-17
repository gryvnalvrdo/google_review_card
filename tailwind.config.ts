import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        ink: "var(--text-ink)",
        subtle: "var(--text-subtle)",
        muted: "var(--text-muted)",
        hairline: "var(--border-hairline)",
        accent: {
          DEFAULT: "#6366F1",
          hover: "#818CF8",
          soft: "rgba(99, 102, 241, 0.14)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
