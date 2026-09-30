// Unit test ringan untuk fungsi murni parseImportedConfig (lib/persistence.ts).
// Fokus pada tiga skenario inti import: valid, JSON rusak, dan config tidak valid.
// Fungsi murni ini dipisahkan dari FileReader agar dapat diuji tanpa DOM.
// Validates: Requirements 8.4, 8.5

import { describe, it, expect } from "vitest";
import { parseImportedConfig } from "./persistence";
import { seedConfig } from "./seed";

describe("parseImportedConfig (Req 8.4, 8.5)", () => {
  it("mengembalikan { config } untuk JSON valid yang lolos validasi skema", () => {
    const text = JSON.stringify(seedConfig);
    const result = parseImportedConfig(text);
    // Sukses harus membawa field config, bukan errors.
    expect("config" in result).toBe(true);
    if ("config" in result) {
      expect(result.config.version).toBe(seedConfig.version);
    }
  });

  it("mengembalikan { errors } untuk JSON yang rusak (tidak bisa di-parse)", () => {
    const result = parseImportedConfig("{ ini bukan json valid");
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("mengembalikan { errors } untuk config dengan version tidak dikenal", () => {
    // JSON valid secara sintaks tetapi gagal validasi skema.
    const broken = { ...seedConfig, version: 999 };
    const result = parseImportedConfig(JSON.stringify(broken));
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
