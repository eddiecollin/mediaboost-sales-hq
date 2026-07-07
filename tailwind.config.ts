import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#121417",
        steel: "#384150",
        line: "#d9dde3",
        money: "#0f8a5f",
        warning: "#b7791f",
        danger: "#c2413d"
      },
      boxShadow: {
        panel: "0 1px 2px rgba(18, 20, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
