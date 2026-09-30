// Konfigurasi minimal Vitest untuk menguji logika pure TypeScript.
// Tidak memerlukan jsdom/testing-library karena hanya menguji fungsi murni.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Lingkungan Node cukup untuk pure functions (tanpa DOM).
    environment: "node",
    // Batasi pemindaian test hanya ke folder lib.
    include: ["lib/**/*.test.ts"],
  },
});
