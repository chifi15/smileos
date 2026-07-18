import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta SmileOS
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
        rewards: {
          starter: "#94a3b8",
          bronze: "#cd7f32",
          silver: "#9ca3af",
          gold: "#f59e0b",
          diamond: "#a78bfa",
        },
      },
    },
  },
  plugins: [],
};

export default config;
