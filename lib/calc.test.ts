// Unit test untuk Calculation Engine (lib/calc.ts).
// Mengikuti prinsip TDD: test ditulis lebih dulu, lalu implementasi menyesuaikan.
// Validates: Requirements 3.2, 3.3, 3.5, 4.2, 4.4, 5.5, 6.2, 6.3, 6.4

import { describe, it, expect } from "vitest";
import {
  calculate,
  selectTier,
  resolveTaskResult,
  resolveRoleResult,
  ALL_STAFF_LEVELS,
} from "./calc";
import type { AppConfig, Category, Question, Task, TaskVariable } from "./types";

// ============================================================================
// Helper pembangun data uji
// ============================================================================

// Membuat AppConfig minimal dari daftar kategori dan pertanyaan.
function makeConfig(
  categories: Category[],
  questions: Question[] = [],
  rates: AppConfig["rates"] = {}
): AppConfig {
  return { version: 2, categories, questions, rates };
}

// Variabel numeric contoh: jumlah subnet dengan 3 tier + default ke tier terkecil.
const numericVariable: TaskVariable = {
  questionId: "q-subnet",
  defaultTierId: "t-1-2",
  tiers: [
    { id: "t-1-2", label: "1-2", min: 1, max: 2, mandays: 0.5 },
    { id: "t-3-5", label: "3-5", min: 3, max: 5, mandays: 0.8 },
    { id: "t-gt5", label: ">5", min: 6, max: null, mandays: 1.2 },
  ],
};

// Variabel single_choice contoh: konsultasi -> "ya" menggeser level ke SR_ENGINEER.
const choiceVariable: TaskVariable = {
  questionId: "q-consult",
  defaultTierId: "c-tidak",
  tiers: [
    {
      id: "c-ya",
      label: "Ya",
      min: null,
      max: null,
      matchOptions: ["ya"],
      mandays: 1,
      levelShift: "SR_ENGINEER",
    },
    {
      id: "c-tidak",
      label: "Tidak",
      min: null,
      max: null,
      matchOptions: ["tidak"],
      mandays: 0,
    },
  ],
};

const qSubnet: Question = {
  id: "q-subnet",
  categoryId: "cat-1",
  text: "Berapa jumlah subnet?",
  type: "numeric",
};

const qConsult: Question = {
  id: "q-consult",
  categoryId: "cat-1",
  text: "Perlu konsultasi?",
  type: "single_choice",
  options: [
    { value: "ya", label: "Ya" },
    { value: "tidak", label: "Tidak" },
  ],
};

// ============================================================================
// selectTier — pemilihan tier
// ============================================================================

describe("selectTier — variabel numeric (Req 3.2)", () => {
  it("memilih tier pertama yang memenuhi min <= nilai <= max", () => {
    expect(selectTier(numericVariable, 2, "numeric")?.id).toBe("t-1-2");
    expect(selectTier(numericVariable, 4, "numeric")?.id).toBe("t-3-5");
  });

  it("memperlakukan batas null sebagai tak terbatas", () => {
    // max null pada tier >5 berarti nilai besar tetap cocok.
    expect(selectTier(numericVariable, 100, "numeric")?.id).toBe("t-gt5");
  });

  it("mengembalikan undefined bila nilai di luar semua rentang", () => {
    // Nilai 0 di bawah min tier terkecil.
    expect(selectTier(numericVariable, 0, "numeric")).toBeUndefined();
  });
});

describe("selectTier — variabel single_choice (Req 3.2)", () => {
  it("memilih tier yang matchOptions memuat nilai jawaban", () => {
    expect(selectTier(choiceVariable, "ya", "single_choice")?.id).toBe("c-ya");
    expect(selectTier(choiceVariable, "tidak", "single_choice")?.id).toBe("c-tidak");
  });

  it("mengembalikan undefined bila nilai tidak termuat di matchOptions manapun", () => {
    expect(selectTier(choiceVariable, "mungkin", "single_choice")).toBeUndefined();
  });
});

// ============================================================================
// resolveRoleResult — hasil per role
// ============================================================================

describe("resolveRoleResult — role tanpa variabel (Req 3.4, 4.5)", () => {
  it("memakai baselineMandays dan level role", () => {
    const r = resolveRoleResult(
      { level: "GENERAL_SA", baselineMandays: 2 },
      {},
      []
    );
    expect(r.mandays).toBe(2);
    expect(r.level).toBe("GENERAL_SA");
    expect(r.tierId).toBeUndefined();
    expect(r.outOfRange).toBeFalsy();
  });
});

describe("resolveRoleResult — tier terpilih & level shift (Req 3.3, 4.2)", () => {
  const roleWithChoice = {
    level: "GENERAL_ENGINEER" as const,
    baselineMandays: 0,
    variable: choiceVariable,
  };

  it("memakai mandays tier dan menggeser level bila tier punya levelShift", () => {
    const r = resolveRoleResult(roleWithChoice, { "q-consult": "ya" }, [qConsult]);
    expect(r.mandays).toBe(1);
    expect(r.level).toBe("SR_ENGINEER");
    expect(r.tierId).toBe("c-ya");
    expect(r.outOfRange).toBeFalsy();
  });

  it("mempertahankan level role bila tier terpilih tidak punya levelShift (Req 4.5)", () => {
    const r = resolveRoleResult(roleWithChoice, { "q-consult": "tidak" }, [qConsult]);
    expect(r.mandays).toBe(0);
    expect(r.level).toBe("GENERAL_ENGINEER");
    expect(r.tierId).toBe("c-tidak");
  });
});

describe("resolveRoleResult — default & out-of-range (Req 2.3, 3.5)", () => {
  const roleWithNumeric = {
    level: "GENERAL_ENGINEER" as const,
    baselineMandays: 0,
    variable: numericVariable,
  };

  it("pakai defaultTierId tanpa outOfRange bila jawaban tidak ada", () => {
    const r = resolveRoleResult(roleWithNumeric, {}, [qSubnet]);
    expect(r.tierId).toBe("t-1-2");
    expect(r.mandays).toBe(0.5);
    expect(r.outOfRange).toBeFalsy();
  });

  it("pakai defaultTierId DAN set outOfRange bila jawaban ada tapi di luar rentang", () => {
    const r = resolveRoleResult(roleWithNumeric, { "q-subnet": 0 }, [qSubnet]);
    expect(r.tierId).toBe("t-1-2");
    expect(r.mandays).toBe(0.5);
    expect(r.outOfRange).toBe(true);
  });
});

// ============================================================================
// resolveTaskResult — menggabungkan seluruh role
// ============================================================================

describe("resolveTaskResult — task multi-role (fitur versi 2)", () => {
  it("menghitung semua role dan menjumlahkan totalMandays", () => {
    const t: Task = {
      id: "t-discuss",
      name: "Diskusi",
      roles: [
        { level: "GENERAL_SA", baselineMandays: 0.5 },
        { level: "GENERAL_PMO", baselineMandays: 0.5 },
      ],
    };
    const r = resolveTaskResult(t, "cat-1", {}, []);
    expect(r.roles).toHaveLength(2);
    expect(r.roles[0].level).toBe("GENERAL_SA");
    expect(r.roles[1].level).toBe("GENERAL_PMO");
    expect(r.totalMandays).toBe(1);
  });
});

// ============================================================================
// calculate — agregasi penuh
// ============================================================================

describe("calculate — input kosong (Req 5.5)", () => {
  it("menghasilkan semua nilai nol tanpa error saat selectedTaskIds kosong", () => {
    const config = makeConfig([
      {
        id: "cat-1",
        name: "Kategori 1",
        tasks: [
          {
            id: "t-1",
            name: "Task 1",
            roles: [{ level: "GENERAL_SA", baselineMandays: 3 }],
          },
        ],
      },
    ]);
    const result = calculate({ config, selectedTaskIds: new Set(), answers: {} });

    expect(result.perTask).toEqual([]);
    expect(result.grandTotalMandays).toBe(0);
    expect(result.grandTotalCost).toBe(0);
    // Semua level hadir dengan nilai nol.
    for (const level of ALL_STAFF_LEVELS) {
      expect(result.totalPerLevel[level]).toBe(0);
      expect(result.costPerLevel[level]).toBe(0);
    }
  });
});

describe("calculate — agregasi per level (Req 5.2, 5.3, 5.4)", () => {
  const config = makeConfig(
    [
      {
        id: "cat-1",
        name: "Infrastructure",
        tasks: [
          {
            id: "t-vpc",
            name: "Configure VPC",
            roles: [
              {
                level: "GENERAL_ENGINEER",
                baselineMandays: 0,
                variable: numericVariable,
              },
            ],
          },
          {
            id: "t-consult",
            name: "Konsultasi Desain",
            roles: [
              {
                level: "GENERAL_ENGINEER",
                baselineMandays: 0,
                variable: choiceVariable,
              },
            ],
          },
        ],
      },
      {
        id: "cat-2",
        name: "Design",
        tasks: [
          {
            id: "t-doc",
            name: "Dokumentasi",
            roles: [{ level: "GENERAL_SA", baselineMandays: 2 }],
          },
        ],
      },
    ],
    [qSubnet, qConsult]
  );

  it("menjumlahkan mandays per kategori-per-level, total per level, dan grand total", () => {
    const result = calculate({
      config,
      selectedTaskIds: new Set(["t-vpc", "t-consult", "t-doc"]),
      // subnet=4 -> tier 3-5 (0.8 md, GENERAL_ENGINEER); konsultasi ya -> 1 md SR_ENGINEER; doc -> 2 md GENERAL_SA
      answers: { "q-subnet": 4, "q-consult": "ya" },
    });

    // per task
    expect(result.perTask).toHaveLength(3);

    // per kategori per level
    expect(result.perCategoryPerLevel["cat-1"].GENERAL_ENGINEER).toBe(0.8);
    expect(result.perCategoryPerLevel["cat-1"].SR_ENGINEER).toBe(1);
    expect(result.perCategoryPerLevel["cat-2"].GENERAL_SA).toBe(2);
    // level yang tidak dipakai tetap 0 sebagai baseline
    expect(result.perCategoryPerLevel["cat-1"].GENERAL_SA).toBe(0);

    // total per level
    expect(result.totalPerLevel.GENERAL_ENGINEER).toBe(0.8);
    expect(result.totalPerLevel.SR_ENGINEER).toBe(1);
    expect(result.totalPerLevel.GENERAL_SA).toBe(2);

    // grand total mandays
    expect(result.grandTotalMandays).toBeCloseTo(3.8, 5);
  });
});

describe("calculate — task multi-role menjumlahkan ke dua level berbeda (fitur versi 2)", () => {
  const config = makeConfig([
    {
      id: "cat-1",
      name: "Design",
      tasks: [
        {
          id: "t-discuss",
          name: "Kickoff Discussion",
          roles: [
            { level: "GENERAL_SA", baselineMandays: 0.5 },
            { level: "GENERAL_PMO", baselineMandays: 0.5 },
          ],
        },
      ],
    },
  ]);

  it("mengakumulasi mandays setiap role ke level masing-masing", () => {
    const result = calculate({
      config,
      selectedTaskIds: new Set(["t-discuss"]),
      answers: {},
    });

    // Satu task, dua role.
    expect(result.perTask).toHaveLength(1);
    expect(result.perTask[0].roles).toHaveLength(2);
    expect(result.perTask[0].totalMandays).toBe(1);

    // Kedua level terisi masing-masing 0.5.
    expect(result.totalPerLevel.GENERAL_SA).toBe(0.5);
    expect(result.totalPerLevel.GENERAL_PMO).toBe(0.5);
    expect(result.perCategoryPerLevel["cat-1"].GENERAL_SA).toBe(0.5);
    expect(result.perCategoryPerLevel["cat-1"].GENERAL_PMO).toBe(0.5);

    expect(result.grandTotalMandays).toBe(1);
  });
});

describe("calculate — biaya (Req 6.2, 6.3, 6.4)", () => {
  const config = makeConfig(
    [
      {
        id: "cat-1",
        name: "Kategori 1",
        tasks: [
          {
            id: "t-a",
            name: "A",
            roles: [{ level: "GENERAL_SA", baselineMandays: 2 }],
          },
          {
            id: "t-b",
            name: "B",
            roles: [{ level: "SR_ENGINEER", baselineMandays: 3 }],
          },
        ],
      },
    ],
    [],
    // Hanya GENERAL_SA yang diberi rate; SR_ENGINEER dibiarkan kosong -> diperlakukan 0.
    { GENERAL_SA: 100 }
  );

  it("menghitung costPerLevel = totalPerLevel * (rate ?? 0) dan grandTotalCost", () => {
    const result = calculate({
      config,
      selectedTaskIds: new Set(["t-a", "t-b"]),
      answers: {},
    });

    expect(result.costPerLevel.GENERAL_SA).toBe(200); // 2 * 100
    expect(result.costPerLevel.SR_ENGINEER).toBe(0); // rate kosong -> 0
    expect(result.grandTotalCost).toBe(200);
    // mandays tetap dihasilkan tanpa error walau sebagian rate kosong
    expect(result.grandTotalMandays).toBe(5);
  });

  it("tanpa rateOverrides tetap memakai config.rates (kompatibilitas lama)", () => {
    // Pemanggilan lama tanpa field rateOverrides harus tetap valid & memakai default.
    const result = calculate({
      config,
      selectedTaskIds: new Set(["t-a", "t-b"]),
      answers: {},
    });
    expect(result.costPerLevel.GENERAL_SA).toBe(200); // pakai default 100
  });

  it("rateOverrides menimpa config.rates untuk level yang dioverride", () => {
    const result = calculate({
      config,
      selectedTaskIds: new Set(["t-a", "t-b"]),
      answers: {},
      // Override GENERAL_SA menjadi 150 (menimpa default 100) dan set SR_ENGINEER 50.
      rateOverrides: { GENERAL_SA: 150, SR_ENGINEER: 50 },
    });

    expect(result.costPerLevel.GENERAL_SA).toBe(300); // 2 * 150 (override menimpa default)
    expect(result.costPerLevel.SR_ENGINEER).toBe(150); // 3 * 50 (override pada level tanpa default)
    expect(result.grandTotalCost).toBe(450);
  });

  it("level tanpa override memakai rate default; override 0 memaksa nol", () => {
    const result = calculate({
      config,
      selectedTaskIds: new Set(["t-a", "t-b"]),
      answers: {},
      // GENERAL_SA dioverride jadi 0 (memaksa nol), SR_ENGINEER tidak dioverride (tetap 0 default kosong).
      rateOverrides: { GENERAL_SA: 0 },
    });

    expect(result.costPerLevel.GENERAL_SA).toBe(0); // override 0 menimpa default 100
    expect(result.costPerLevel.SR_ENGINEER).toBe(0); // tanpa override & tanpa default
    expect(result.grandTotalCost).toBe(0);
  });
});
