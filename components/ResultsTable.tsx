"use client";

// ResultsTable — UI langkah ketiga estimasi: menampilkan hasil perhitungan mandays (Req 5).
//
// Fungsi utama:
// - Menghitung EstimationResult secara REAKTIF dengan useMemo yang memanggil calculate()
//   dari lib/calc.ts setiap kali config, selectedTaskIds, atau answers berubah (Req 2.5).
// - Menampilkan tabel per task: nama task, mandays, level (label human-readable),
//   dengan penanda visual bila jawaban di luar rentang tier (outOfRange) (Req 5.1, 3.5).
// - Mengelompokkan baris per kategori dengan subtotal per kategori (Req 5.2).
// - Menampilkan total mandays per level untuk seluruh task terpilih (Req 5.3).
// - Menampilkan grand total mandays keseluruhan (Req 5.4).
// - Saat tidak ada task terpilih, menampilkan nilai nol / empty state tanpa error (Req 5.5).
//
// Catatan: komponen ini hanya membaca state (config + session) dan tidak memutasi apa pun.

import { useMemo } from "react";

import { useConfig, useSession } from "../context/ConfigContext";
import { ALL_STAFF_LEVELS, calculate } from "../lib/calc";
import { staffLevelLabel } from "../lib/types";
import type { EstimationResult, StaffLevel, TaskResult } from "../lib/types";

// ============================================================================
// Helper format
// ============================================================================

// Format nilai mandays agar ringkas: buang nol desimal berlebih (mis. 0.50 -> "0.5", 2 -> "2").
function formatMandays(value: number): string {
  // Bulatkan ringan untuk menghindari galat floating point (mis. 0.30000000000000004).
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

// Menyaring level yang benar-benar terpakai (nilai > 0) dari sebuah record level.
// Dipakai agar kolom/baris level yang kosong tidak memenuhi tampilan.
function usedLevels(totalPerLevel: Record<StaffLevel, number>): StaffLevel[] {
  return ALL_STAFF_LEVELS.filter((level) => totalPerLevel[level] > 0);
}

// ============================================================================
// Komponen utama
// ============================================================================

export function ResultsTable() {
  // Config menyediakan definisi kategori/task/pertanyaan/rate.
  const { config } = useConfig();
  // Session menyediakan task terpilih dan jawaban kuisioner (Req 1.3, 2.5).
  const { selectedTaskIds, answers } = useSession();

  // Hitung ulang hasil secara reaktif setiap input berubah (Req 2.5).
  const result: EstimationResult = useMemo(
    () => calculate({ config, selectedTaskIds, answers }),
    [config, selectedTaskIds, answers],
  );

  // Peta id kategori -> nama, untuk judul grup.
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of config.categories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [config.categories]);

  // Kelompokkan hasil per task ke dalam kategori, menjaga urutan kategori pada config.
  const groups = useMemo(() => {
    const byCategory = new Map<string, TaskResult[]>();
    for (const task of result.perTask) {
      const list = byCategory.get(task.categoryId);
      if (list) {
        list.push(task);
      } else {
        byCategory.set(task.categoryId, [task]);
      }
    }

    const ordered: { categoryId: string; categoryName: string; tasks: TaskResult[] }[] = [];
    for (const category of config.categories) {
      const tasks = byCategory.get(category.id);
      if (tasks && tasks.length > 0) {
        ordered.push({
          categoryId: category.id,
          categoryName: categoryNameById.get(category.id) ?? category.id,
          tasks,
        });
      }
    }
    return ordered;
  }, [result.perTask, config.categories, categoryNameById]);

  // Empty state: tidak ada task terpilih (Req 5.5). Tetap tampilkan ringkasan nol.
  const isEmpty = result.perTask.length === 0;

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">Hasil Estimasi</h2>
        <p className="mt-1 text-sm text-ink/70">
          Ringkasan mandays per task, per kategori, dan total per level. Dihitung
          ulang otomatis setiap pilihan task atau jawaban berubah.
        </p>
      </header>

      {isEmpty ? (
        // Empty state jelas namun tanpa error; angka total tetap nol (Req 5.5).
        <p className="rounded-md border border-ink/10 bg-white/50 p-4 text-sm text-ink/60">
          Belum ada task terpilih. Total mandays: <span className="font-semibold text-ink">0</span>.
          Pilih task pada langkah pertama untuk melihat rincian estimasi.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Rincian per kategori dengan subtotal per kategori (Req 5.1, 5.2). */}
          {groups.map((group) => (
            <CategoryTable
              key={group.categoryId}
              categoryName={group.categoryName}
              tasks={group.tasks}
              subtotal={result.perCategoryPerLevel[group.categoryId]}
            />
          ))}

          {/* Ringkasan total per level & grand total (Req 5.3, 5.4). */}
          <TotalsTable result={result} />
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Sub-komponen: tabel satu kategori + subtotal
// ============================================================================

interface CategoryTableProps {
  categoryName: string;
  tasks: TaskResult[];
  // Subtotal per level untuk kategori ini (dari perCategoryPerLevel).
  subtotal: Record<StaffLevel, number> | undefined;
}

function CategoryTable({ categoryName, tasks, subtotal }: CategoryTableProps) {
  // Subtotal mandays seluruh task pada kategori ini.
  const categoryTotal = tasks.reduce((sum, task) => sum + task.mandays, 0);

  // Daftar level yang terpakai pada kategori ini, untuk ringkasan subtotal per level.
  const levels = subtotal ? usedLevels(subtotal) : [];

  return (
    <div className="overflow-hidden rounded-lg border border-ink/15 bg-white/60">
      <table className="w-full border-collapse text-sm">
        <caption className="border-b border-ink/10 px-4 py-3 text-left font-semibold text-ink">
          {categoryName}
        </caption>
        <thead>
          <tr className="bg-cream text-left text-ink">
            <th scope="col" className="px-4 py-2 font-medium">
              Task
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Mandays
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Level
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.taskId} className="border-t border-ink/10">
              <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                {task.taskName}
                {/* Penanda out-of-range: jawaban di luar rentang tier, memakai default (Req 3.5). */}
                {task.outOfRange && (
                  <span
                    className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                    title="Jawaban di luar rentang tier, memakai tier default."
                  >
                    di luar rentang
                  </span>
                )}
              </th>
              <td className="px-4 py-2 text-right tabular-nums text-ink">
                {formatMandays(task.mandays)}
              </td>
              <td className="px-4 py-2 text-ink">{staffLevelLabel(task.level)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* Subtotal mandays kategori (Req 5.2). */}
          <tr className="border-t-2 border-ink/20 bg-cream/60 font-semibold text-ink">
            <th scope="row" className="px-4 py-2 text-left">
              Subtotal kategori
            </th>
            <td className="px-4 py-2 text-right tabular-nums">
              {formatMandays(categoryTotal)}
            </td>
            <td className="px-4 py-2 text-xs font-normal text-ink/70">
              {/* Rincian subtotal per level di dalam kategori. */}
              {levels.length > 0
                ? levels
                    .map(
                      (level) =>
                        `${staffLevelLabel(level)}: ${formatMandays(subtotal![level])}`,
                    )
                    .join(" · ")
                : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================================
// Sub-komponen: total per level & grand total
// ============================================================================

interface TotalsTableProps {
  result: EstimationResult;
}

function TotalsTable({ result }: TotalsTableProps) {
  // Hanya tampilkan level yang benar-benar terpakai (Req 5.3).
  const levels = usedLevels(result.totalPerLevel);

  return (
    <div className="overflow-hidden rounded-lg border border-ink/20 bg-white/70">
      <table className="w-full border-collapse text-sm">
        <caption className="border-b border-ink/10 px-4 py-3 text-left font-semibold text-ink">
          Total Keseluruhan
        </caption>
        <thead>
          <tr className="bg-cream text-left text-ink">
            <th scope="col" className="px-4 py-2 font-medium">
              Level
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Total Mandays
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Total per level untuk seluruh task terpilih (Req 5.3). */}
          {levels.map((level) => (
            <tr key={level} className="border-t border-ink/10">
              <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                {staffLevelLabel(level)}
              </th>
              <td className="px-4 py-2 text-right tabular-nums text-ink">
                {formatMandays(result.totalPerLevel[level])}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* Grand total mandays keseluruhan (Req 5.4). */}
          <tr className="border-t-2 border-ink/20 bg-cream/60 text-base font-bold text-ink">
            <th scope="row" className="px-4 py-2 text-left">
              Grand total mandays
            </th>
            <td className="px-4 py-2 text-right tabular-nums">
              {formatMandays(result.grandTotalMandays)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default ResultsTable;
