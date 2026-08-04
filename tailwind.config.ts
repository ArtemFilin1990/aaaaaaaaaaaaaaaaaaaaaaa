import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#111111",
        warm: "#F6F5F3",
        steel: "#C8C8C8",
        signal: "#F26A21",
        navy: "#223448"
      }
    }
  },
  plugins: []
};

export default config;
