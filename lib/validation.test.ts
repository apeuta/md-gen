// Unit test untuk validasi skema konfigurasi (lib/validation.ts).
// Ditulis lebih dulu secara TDD; implementasi di task 5.2 mengikuti kontrak API ini.
// Kontrak API: validateConfig(config: unknown) -> { valid: boolean; errors: string[] }
// Validates: Requirements 8.5, 7.6

import { describe, it, expect } from "vitest";
import { validateConfig } from "./validation";
import type { AppConfig, Category, Question } from "./types";

// ============================================================================
// Helper pembangun data uji
// ============================================================================

// Membangun AppConfig valid minimal yang bisa dimodifikasi per skenario.
// Task "Configure VPC" punya variabel numeric dengan tier tidak tumpang tindih,
// merujuk ke pertanyaan yang tersedia -> config ini harus lolos validasi.
function makeValidConfig(): AppConfig {
  const questions: Question[] = [
    {
      id: "q-subnet",
      categoryId: "cat-1",
      text: "Berapa jumlah subnet?",
      type: "numeric",
    },
  ];

  const categories: Category[] = [
    {
      id: "cat-1",
      name: "Infrastructure Setup",
      tasks: [
        {
          id: "t-vpc",
          name: "Configure VPC",
          roles: [
            {
              level: "GENERAL_ENGINEER",
              baselineMandays: 0,
              variable: {
                questionId: "q-subnet",
                defaultTierId: "t-1-2",
                tiers: [
                  { id: "t-1-2", label: "1-2", min: 1, max: 2, mandays: 0.5 },
                  { id: "t-3-5", label: "3-5", min: 3, max: 5, mandays: 0.8 },
                  { id: "t-gt5", label: ">5", min: 6, max: null, mandays: 1.2 },
                ],
              },
            },
          ],
        },
        {
          id: "t-plain",
          name: "Task Tanpa Variabel",
          roles: [{ level: "GENERAL_SA", baselineMandays: 2 }],
        },
      ],
    },
  ];

  return { version: 2, categories, questions, rates: { GENERAL_SA: 100 } };
}

// ============================================================================
// Config valid
// ============================================================================

describe("validateConfig — config valid (Req 8.5)", () => {
  it("meloloskan config yang benar tanpa error", () => {
    const result = validateConfig(makeValidConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ============================================================================
// version tidak dikenal (Req 8.5)
// ============================================================================

describe("validateConfig — version (Req 8.5)", () => {
  it("menolak config dengan version yang tidak dikenal", () => {
    const config = makeValidConfig();
    // Versi 999 belum didukung skema aplikasi.
    const broken = { ...config, version: 999 };
    const result = validateConfig(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// categories/questions bukan array (Req 8.5)
// ============================================================================

describe("validateConfig — struktur array (Req 8.5)", () => {
  it("menolak bila categories bukan array", () => {
    const config = makeValidConfig();
    // Rusak secara sengaja: categories seharusnya array.
    const broken = { ...config, categories: "bukan-array" };
    const result = validateConfig(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("menolak bila questions bukan array", () => {
    const config = makeValidConfig();
    const broken = { ...config, questions: 123 };
    const result = validateConfig(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("menolak input yang bukan objek sama sekali", () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig("string").valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
  });
});

// ============================================================================
// mandays / baselineMandays negatif (Req 7.6)
// ============================================================================

describe("validateConfig — nilai mandays non-negatif (Req 7.6)", () => {
  it("menolak baselineMandays role yang negatif", () => {
    const config = makeValidConfig();
    config.categories[0].tasks[1].roles[0].baselineMandays = -1;
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("menolak mandays tier yang negatif", () => {
    const config = makeValidConfig();
    // Tier pertama pada role dengan variabel dibuat negatif.
    config.categories[0].tasks[0].roles[0].variable!.tiers[0].mandays = -0.5;
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// roles wajib non-kosong & level valid (fitur versi 2)
// ============================================================================

describe("validateConfig — roles wajib valid (fitur versi 2)", () => {
  it("menolak task dengan roles kosong", () => {
    const config = makeValidConfig();
    config.categories[0].tasks[1].roles = [];
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("menolak role dengan level tak dikenal", () => {
    const config = makeValidConfig();
    // Level sengaja dirusak menjadi nilai yang tidak dikenal.
    (config.categories[0].tasks[1].roles[0] as { level: string }).level =
      "TIDAK_DIKENAL";
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("meloloskan task multi-role yang valid", () => {
    const config = makeValidConfig();
    config.categories[0].tasks.push({
      id: "t-multi",
      name: "Diskusi",
      roles: [
        { level: "GENERAL_SA", baselineMandays: 0.5 },
        { level: "GENERAL_PMO", baselineMandays: 0.5 },
      ],
    });
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ============================================================================
// Tier numeric tumpang tindih ambigu (Req 7.6)
// ============================================================================

describe("validateConfig — tier tidak boleh tumpang tindih ambigu (Req 7.6)", () => {
  it("menolak dua tier numeric dengan rentang yang saling tumpang tindih", () => {
    const config = makeValidConfig();
    // Tier "t-1-2" (1..2) dan "t-3-5" diubah menjadi (2..5) -> nilai 2 cocok keduanya.
    config.categories[0].tasks[0].roles[0].variable!.tiers[1].min = 2;
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// defaultTierId menunjuk tier yang tidak ada (Req 7.6)
// ============================================================================

describe("validateConfig — defaultTierId valid (Req 7.6)", () => {
  it("menolak defaultTierId yang tidak menunjuk tier manapun", () => {
    const config = makeValidConfig();
    config.categories[0].tasks[0].roles[0].variable!.defaultTierId =
      "tier-tidak-ada";
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// questionId menunjuk Question yang tidak ada (Req 7.6 / relasi model)
// ============================================================================

describe("validateConfig — referensi questionId valid (Req 7.6)", () => {
  it("menolak variable.questionId yang tidak menunjuk Question manapun", () => {
    const config = makeValidConfig();
    config.categories[0].tasks[0].roles[0].variable!.questionId = "q-tidak-ada";
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
