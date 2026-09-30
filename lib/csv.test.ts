// Unit test untuk pembangun CSV (lib/csv.ts).
// Menguji: header tepat & berurutan; penomoran kategori A/B & task A.1/A.2;
// multi-role mengisi beberapa kolom pada satu baris; sel kosong untuk level tak terpakai;
// baris Grand Total = totalPerLevel; escaping nilai bernama koma/kutip.

import { describe, it, expect } from "vitest";
import {
  buildCsv,
  categoryLetter,
  escapeCsvValue,
  formatMandays,
  CSV_HEADER,
  CSV_LEVEL_COLUMNS,
} from "./csv";
import { ALL_STAFF_LEVELS } from "./calc";
import type {
  AppConfig,
  Category,
  EstimationResult,
  StaffLevel,
  TaskResult,
} from "./types";

// ============================================================================
// Helper pembangun data uji
// ============================================================================

// Membuat record level bernilai 0 untuk seluruh level.
function emptyLevels(): Record<StaffLevel, number> {
  const record = {} as Record<StaffLevel, number>;
  for (const level of ALL_STAFF_LEVELS) {
    record[level] = 0;
  }
  return record;
}

// Membuat totalPerLevel dari partial (level yang tidak disebut = 0).
function levels(partial: Partial<Record<StaffLevel, number>>): Record<StaffLevel, number> {
  return { ...emptyLevels(), ...partial };
}

// Membuat AppConfig minimal dari daftar kategori.
function makeConfig(categories: Category[]): AppConfig {
  return { version: 2, categories, questions: [], rates: {} };
}

// Memecah string CSV menjadi array baris (memisah CRLF).
function rows(csv: string): string[] {
  return csv.split("\r\n");
}

// ============================================================================
// Helper murni
// ============================================================================

describe("helper murni", () => {
  it("categoryLetter menghasilkan A, B, C, ... berurutan", () => {
    expect(categoryLetter(0)).toBe("A");
    expect(categoryLetter(1)).toBe("B");
    expect(categoryLetter(25)).toBe("Z");
    expect(categoryLetter(26)).toBe("AA");
  });

  it("formatMandays membuang desimal berlebih & mengosongkan nol", () => {
    expect(formatMandays(0.5)).toBe("0.5");
    expect(formatMandays(2)).toBe("2");
    expect(formatMandays(0)).toBe("");
    expect(formatMandays(0, false)).toBe("0");
  });

  it("escapeCsvValue membungkus & escape nilai bernama koma/kutip/newline", () => {
    expect(escapeCsvValue("biasa")).toBe("biasa");
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
    expect(escapeCsvValue('kata "penting"')).toBe('"kata ""penting"""');
    expect(escapeCsvValue("baris1\nbaris2")).toBe('"baris1\nbaris2"');
  });
});

// ============================================================================
// buildCsv
// ============================================================================

describe("buildCsv", () => {
  it("header tepat & berurutan", () => {
    const config = makeConfig([]);
    const result: EstimationResult = {
      perTask: [],
      perCategoryPerLevel: {},
      totalPerLevel: emptyLevels(),
      grandTotalMandays: 0,
      costPerLevel: emptyLevels(),
      grandTotalCost: 0,
    };
    const csv = buildCsv(result, config);
    const [headerLine] = rows(csv);
    expect(headerLine).toBe(
      "No,Task,General Eng,Sr. Eng,General SA,Sr. SA,General PMO,Sr. PMO,SME",
    );
    // Konsistensi CSV_HEADER dengan urutan yang diharapkan.
    expect(CSV_HEADER).toEqual([
      "No",
      "Task",
      "General Eng",
      "Sr. Eng",
      "General SA",
      "Sr. SA",
      "General PMO",
      "Sr. PMO",
      "SME",
    ]);
    expect(CSV_LEVEL_COLUMNS.length).toBe(7);
  });

  it("penomoran kategori A/B dan task A.1/A.2; sel kosong untuk level tak terpakai", () => {
    const config = makeConfig([
      {
        id: "cat-a",
        name: "Kategori A",
        tasks: [
          { id: "t1", name: "Task 1", roles: [] },
          { id: "t2", name: "Task 2", roles: [] },
        ],
      },
      {
        id: "cat-b",
        name: "Kategori B",
        tasks: [{ id: "t3", name: "Task 3", roles: [] }],
      },
    ]);

    const result: EstimationResult = {
      perTask: [
        {
          taskId: "t1",
          taskName: "Task 1",
          categoryId: "cat-a",
          roles: [{ level: "GENERAL_ENGINEER", mandays: 2 }],
          totalMandays: 2,
        },
        {
          taskId: "t2",
          taskName: "Task 2",
          categoryId: "cat-a",
          roles: [{ level: "SR_SA", mandays: 1.5 }],
          totalMandays: 1.5,
        },
        {
          taskId: "t3",
          taskName: "Task 3",
          categoryId: "cat-b",
          roles: [{ level: "SME", mandays: 3 }],
          totalMandays: 3,
        },
      ],
      perCategoryPerLevel: {},
      totalPerLevel: levels({
        GENERAL_ENGINEER: 2,
        SR_SA: 1.5,
        SME: 3,
      }),
      grandTotalMandays: 6.5,
      costPerLevel: emptyLevels(),
      grandTotalCost: 0,
    };

    const lines = rows(buildCsv(result, config));
    // [0] header, [1] kat A, [2] A.1, [3] A.2, [4] kat B, [5] B.1, [6] grand total
    expect(lines[1]).toBe("A,Kategori A,,,,,,,");
    // Task 1: General Eng = 2, sisanya kosong.
    expect(lines[2]).toBe("A.1,Task 1,2,,,,,,");
    // Task 2: Sr. SA = 1.5 (kolom ke-4 level).
    expect(lines[3]).toBe("A.2,Task 2,,,,1.5,,,");
    expect(lines[4]).toBe("B,Kategori B,,,,,,,");
    // Task 3: SME = 3 (kolom terakhir).
    expect(lines[5]).toBe("B.1,Task 3,,,,,,,3");
  });

  it("multi-role mengisi beberapa kolom & menjumlahkan role level sama pada satu baris", () => {
    const config = makeConfig([
      {
        id: "cat-a",
        name: "Kat",
        tasks: [{ id: "t1", name: "Task Multi", roles: [] }],
      },
    ]);
    const result: EstimationResult = {
      perTask: [
        {
          taskId: "t1",
          taskName: "Task Multi",
          categoryId: "cat-a",
          roles: [
            { level: "GENERAL_ENGINEER", mandays: 2 },
            { level: "GENERAL_PMO", mandays: 1 },
            // Role kedua di level yang sama harus dijumlahkan.
            { level: "GENERAL_ENGINEER", mandays: 0.5 },
          ],
          totalMandays: 3.5,
        },
      ],
      perCategoryPerLevel: {},
      totalPerLevel: levels({ GENERAL_ENGINEER: 2.5, GENERAL_PMO: 1 }),
      grandTotalMandays: 3.5,
      costPerLevel: emptyLevels(),
      grandTotalCost: 0,
    };

    const lines = rows(buildCsv(result, config));
    // General Eng (kolom 1) = 2 + 0.5 = 2.5, General PMO (kolom 5) = 1.
    expect(lines[2]).toBe("A.1,Task Multi,2.5,,,,1,,");
  });

  it("baris Grand Total = totalPerLevel", () => {
    const config = makeConfig([
      {
        id: "cat-a",
        name: "Kat",
        tasks: [{ id: "t1", name: "Task 1", roles: [] }],
      },
    ]);
    const result: EstimationResult = {
      perTask: [
        {
          taskId: "t1",
          taskName: "Task 1",
          categoryId: "cat-a",
          roles: [{ level: "SR_ENGINEER", mandays: 4 }],
          totalMandays: 4,
        },
      ],
      perCategoryPerLevel: {},
      totalPerLevel: levels({ SR_ENGINEER: 4, GENERAL_SA: 2 }),
      grandTotalMandays: 6,
      costPerLevel: emptyLevels(),
      grandTotalCost: 0,
    };

    const lines = rows(buildCsv(result, config));
    const grandTotalLine = lines[lines.length - 1];
    // Sr. Eng (kolom 2) = 4, General SA (kolom 3) = 2.
    expect(grandTotalLine).toBe(",Grand Total,,4,2,,,,");
  });

  it("escaping nilai bernama koma/kutip pada nama task/kategori", () => {
    const config = makeConfig([
      {
        id: "cat-a",
        name: 'Kategori, "khusus"',
        tasks: [{ id: "t1", name: "Task, satu", roles: [] }],
      },
    ]);
    const result: EstimationResult = {
      perTask: [
        {
          taskId: "t1",
          taskName: "Task, satu",
          categoryId: "cat-a",
          roles: [{ level: "GENERAL_ENGINEER", mandays: 1 }],
          totalMandays: 1,
        },
      ],
      perCategoryPerLevel: {},
      totalPerLevel: levels({ GENERAL_ENGINEER: 1 }),
      grandTotalMandays: 1,
      costPerLevel: emptyLevels(),
      grandTotalCost: 0,
    };

    const lines = rows(buildCsv(result, config));
    expect(lines[1]).toBe('A,"Kategori, ""khusus""",,,,,,,');
    expect(lines[2]).toBe('A.1,"Task, satu",1,,,,,,');
  });

  it("hanya menyertakan kategori/task terpilih & menjaga urutan config", () => {
    // Config punya 2 kategori, tapi hanya kategori kedua yang punya task terpilih.
    const config = makeConfig([
      {
        id: "cat-kosong",
        name: "Kategori Tanpa Pilihan",
        tasks: [{ id: "tx", name: "Task X", roles: [] }],
      },
      {
        id: "cat-isi",
        name: "Kategori Terisi",
        tasks: [
          { id: "t1", name: "Task 1", roles: [] },
          { id: "t2", name: "Task 2", roles: [] },
        ],
      },
    ]);
    const result: EstimationResult = {
      perTask: [
        // Sengaja urutan perTask dibalik untuk memastikan urutan mengikuti config.
        {
          taskId: "t2",
          taskName: "Task 2",
          categoryId: "cat-isi",
          roles: [{ level: "GENERAL_ENGINEER", mandays: 1 }],
          totalMandays: 1,
        },
        {
          taskId: "t1",
          taskName: "Task 1",
          categoryId: "cat-isi",
          roles: [{ level: "GENERAL_ENGINEER", mandays: 2 }],
          totalMandays: 2,
        },
      ],
      perCategoryPerLevel: {},
      totalPerLevel: levels({ GENERAL_ENGINEER: 3 }),
      grandTotalMandays: 3,
      costPerLevel: emptyLevels(),
      grandTotalCost: 0,
    };

    const lines = rows(buildCsv(result, config));
    // Kategori kosong tidak muncul; kategori terisi jadi "A" (bukan "B").
    expect(lines[1]).toBe("A,Kategori Terisi,,,,,,,");
    // Urutan task mengikuti config: Task 1 dulu (A.1), lalu Task 2 (A.2).
    expect(lines[2]).toBe("A.1,Task 1,2,,,,,,");
    expect(lines[3]).toBe("A.2,Task 2,1,,,,,,");
  });
});
