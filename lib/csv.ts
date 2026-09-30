// Modul pembangun CSV untuk hasil estimasi (Export CSV).
// Seluruh fungsi di sini adalah fungsi murni (pure) tanpa efek samping,
// agar mudah diuji dan tidak bergantung pada DOM/browser.
//
// Format CSV mengikuti spesifikasi tetap:
// - Kolom: No, Task, lalu 7 kolom level dengan urutan yang tetap.
// - Baris kategori diberi huruf berurutan (A, B, C, ...), task diberi nomor per
//   kategori (A.1, A.2, ...). Hanya kategori/task terpilih (ada di result.perTask)
//   yang disertakan, mengikuti urutan pada config.
// - Baris terakhir adalah Grand Total dari totalPerLevel.

import type { AppConfig, EstimationResult, StaffLevel, TaskResult } from "./types";

// ============================================================================
// Konstanta pemetaan kolom
// ============================================================================

// Definisi urutan kolom level pada CSV: header kolom -> StaffLevel.
// Urutan ini WAJIB tetap dan dipakai konsisten untuk header maupun sel data.
// Diekspor sebagai konstanta agar mudah diuji.
export const CSV_LEVEL_COLUMNS: { header: string; level: StaffLevel }[] = [
  { header: "General Eng", level: "GENERAL_ENGINEER" },
  { header: "Sr. Eng", level: "SR_ENGINEER" },
  { header: "General SA", level: "GENERAL_SA" },
  { header: "Sr. SA", level: "SR_SA" },
  { header: "General PMO", level: "GENERAL_PMO" },
  { header: "Sr. PMO", level: "SR_PMO" },
  { header: "SME", level: "SME" },
];

// Header lengkap CSV secara berurutan: No, Task, lalu seluruh kolom level.
export const CSV_HEADER: string[] = [
  "No",
  "Task",
  ...CSV_LEVEL_COLUMNS.map((c) => c.header),
];

// Pemisah baris CSV (konsisten memakai CRLF, lazim untuk berkas CSV).
const ROW_SEPARATOR = "\r\n";

// ============================================================================
// Helper murni
// ============================================================================

// Mengubah indeks kategori (0-based) menjadi huruf: 0 -> "A", 1 -> "B", ...
// Untuk indeks >= 26 memakai pola dua huruf (AA, AB, ...) sebagai pengaman.
export function categoryLetter(index: number): string {
  let n = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

// Format nilai mandays agar ringkas: buang nol desimal berlebih (mis. 0.5, 2).
// Nilai 0 dikembalikan sebagai string kosong bila `blankZero` true (default),
// agar sel level yang tidak terpakai tampil kosong, bukan 0.
export function formatMandays(value: number, blankZero: boolean = true): string {
  // Bulatkan ringan untuk menghindari galat floating point.
  const rounded = Math.round(value * 1000) / 1000;
  if (rounded === 0 && blankZero) {
    return "";
  }
  return String(rounded);
}

// Escape satu nilai sel CSV.
// Bila nilai mengandung koma, kutip ganda, atau newline, bungkus dengan kutip
// ganda dan escape kutip ganda internal menjadi dua kutip ganda.
export function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Merangkai satu baris (array sel) menjadi string CSV yang sudah di-escape.
function toCsvRow(cells: string[]): string {
  return cells.map(escapeCsvValue).join(",");
}

// Menjumlahkan mandays per level untuk sebuah task (menggabungkan bila ada
// >1 role di level yang sama).
function sumRoleMandaysByLevel(task: TaskResult): Record<StaffLevel, number> {
  const record = {} as Record<StaffLevel, number>;
  for (const col of CSV_LEVEL_COLUMNS) {
    record[col.level] = 0;
  }
  for (const role of task.roles) {
    record[role.level] += role.mandays;
  }
  return record;
}

// ============================================================================
// Fungsi utama
// ============================================================================

// Membangun string CSV dari hasil estimasi dan config.
// Urutan baris mengikuti urutan kategori & task pada config; hanya kategori/task
// terpilih (ada di result.perTask) yang disertakan.
export function buildCsv(result: EstimationResult, config: AppConfig): string {
  const rows: string[] = [];

  // Baris header.
  rows.push(toCsvRow(CSV_HEADER));

  // Kelompokkan hasil task terpilih berdasarkan categoryId untuk pencarian cepat.
  const tasksByCategory = new Map<string, TaskResult[]>();
  for (const task of result.perTask) {
    const list = tasksByCategory.get(task.categoryId);
    if (list) {
      list.push(task);
    } else {
      tasksByCategory.set(task.categoryId, [task]);
    }
  }

  // Iterasi kategori mengikuti urutan pada config; hanya sertakan yang punya task terpilih.
  let categoryIndex = 0;
  for (const category of config.categories) {
    const tasks = tasksByCategory.get(category.id);
    if (!tasks || tasks.length === 0) {
      continue;
    }

    const letter = categoryLetter(categoryIndex);
    categoryIndex += 1;

    // Baris kategori: No = huruf, Task = nama kategori, kolom level dikosongkan.
    const categoryRow = [letter, category.name, ...CSV_LEVEL_COLUMNS.map(() => "")];
    rows.push(toCsvRow(categoryRow));

    // Urutkan task mengikuti urutan task pada config (bukan urutan perTask).
    // Buat peta taskId -> TaskResult, lalu iterasi task pada config.
    const resultByTaskId = new Map<string, TaskResult>();
    for (const t of tasks) {
      resultByTaskId.set(t.taskId, t);
    }

    let taskNumber = 0;
    for (const configTask of category.tasks) {
      const taskResult = resultByTaskId.get(configTask.id);
      if (!taskResult) {
        continue;
      }
      taskNumber += 1;

      const perLevel = sumRoleMandaysByLevel(taskResult);
      const levelCells = CSV_LEVEL_COLUMNS.map((col) =>
        formatMandays(perLevel[col.level], true),
      );
      const taskRow = [`${letter}.${taskNumber}`, taskResult.taskName, ...levelCells];
      rows.push(toCsvRow(taskRow));
    }
  }

  // Baris Grand Total: No dikosongkan, Task = "Grand Total", tiap level dari totalPerLevel.
  // Konsisten dengan baris task: tulis angka bila > 0, kosong bila 0.
  const totalCells = CSV_LEVEL_COLUMNS.map((col) =>
    formatMandays(result.totalPerLevel[col.level], true),
  );
  const grandTotalRow = ["", "Grand Total", ...totalCells];
  rows.push(toCsvRow(grandTotalRow));

  return rows.join(ROW_SEPARATOR);
}
