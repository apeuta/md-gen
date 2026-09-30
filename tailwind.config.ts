import type { Config } from "tailwindcss";

// Konfigurasi Tailwind: pindai file di app/ dan components/ untuk kelas utility.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Palet warna aplikasi: krem terang untuk background, hampir hitam untuk teks.
      colors: {
        cream: "#FEF9E7",
        ink: "#1A1A1A",
      },
      // Font utama memakai CSS variable dari next/font (Open Sans).
      fontFamily: {
        sans: ["var(--font-open-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
