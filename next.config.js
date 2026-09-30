const path = require("path");

/** @type {import('next').NextConfig} */
// Konfigurasi Next.js minimal untuk pilot.
const nextConfig = {
  reactStrictMode: true,
  // Tetapkan root file tracing ke folder proyek ini agar Next.js tidak
  // salah menyimpulkan workspace root ketika ada lockfile lain di parent.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
