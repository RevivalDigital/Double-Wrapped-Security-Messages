import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {}, // Kosongkan karena sudah didefinisikan di globals.css (@theme)
  },
  plugins: [], // Kosongkan jika belum running 'npm install tailwindcss-animate'
};

export default config;