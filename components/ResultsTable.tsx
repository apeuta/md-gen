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
import type {
  EstimationResult,
  RateTable,
  StaffLevel,
  TaskResult,
} from "../lib/types";

// ============================================================================
// Helper format
// ============================================================================

// Format nilai mandays agar ringkas: buang nol desimal berlebih (mis. 0.50 -> "0.5", 2 -> "2").
function formatMandays(value: number): string {
  // Bulatkan ringan untuk menghindari galat floating point (mis. 0.30000000000000004).
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

// Formatter biaya dengan pemisah ribuan (locale Indonesia), maks 2 desimal.
// Selaras dengan tampilan biaya di RatePanel.
const AMOUNT_FORMAT = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

// Format nilai biaya menjadi string berpemisah ribuan.
function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return AMOUNT_FORMAT.format(rounded);
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
  // Config menyediakan definisi kategori/task/pertanyaan/rate default.
  const { config } = useConfig();
  // Session menyediakan task terpilih, jawaban, dan override rate sesi (Req 1.3, 2.5).
  const { selectedTaskIds, answers, rateOverrides } = useSession();

  // Hitung ulang hasil secara reaktif setiap input berubah (Req 2.5).
  // rateOverrides diteruskan agar biaya konsisten dengan tampilan RatePanel.
  const result: EstimationResult = useMemo(
    () => calculate({ config, selectedTaskIds, answers, rateOverrides }),
    [config, selectedTaskIds, answers, rateOverrides],
  );

  // Fungsi rate efektif per level: override sesi bila ada, selain itu default config, selain itu 0.
  const effectiveRate = useMemo(() => {
    const rates: RateTable = config.rates;
    return (level: StaffLevel): number =>
      rateOverrides[level] ?? rates[level] ?? 0;
  }, [config.rates, rateOverrides]);

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

  // Catatan: tombol Export CSV kini tunggal, berada di bar navigasi langkah Hasil
  // (lihat AppShell -> ExportCsvButton), sehingga tidak lagi diletakkan di header ini.

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">Hasil Estimasi</h2>
        <p className="mt-1 text-sm text-ink/70">
          Ringkasan mandays per task, per kategori, dan total per level. Kolom biaya
          per role memakai rate efektif (override sesi bila ada, selain itu rate
          default konfigurasi). Dihitung ulang otomatis setiap pilihan berubah.
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
              effectiveRate={effectiveRate}
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
  // Fungsi rate efektif per level (override sesi ?? default config ?? 0).
  effectiveRate: (level: StaffLevel) => number;
}

function CategoryTable({
  categoryName,
  tasks,
  subtotal,
  effectiveRate,
}: CategoryTableProps) {
  // Subtotal mandays seluruh task pada kategori ini (menjumlahkan semua role).
  const categoryTotal = tasks.reduce((sum, task) => sum + task.totalMandays, 0);

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
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Biaya
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Setiap task ditampilkan sebagai baris judul, lalu satu sub-baris per role
              berisi (level, mandays, biaya, penanda out-of-range per role) (Req 5.1, 3.5). */}
          {tasks.map((task) => (
            <TaskRows key={task.taskId} task={task} effectiveRate={effectiveRate} />
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
            {/* Kolom biaya pada subtotal dikosongkan; biaya ditampilkan per role. */}
            <td className="px-4 py-2" aria-hidden="true" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================================
// Sub-komponen: baris satu task (judul task + sub-baris per role)
// ============================================================================

// Menghitung tampilan biaya sebuah role: mandays × rate efektif level role.
// Bila rate efektif 0, tampilkan "—" agar tabel tidak ramai (sesuai permintaan).
function roleCostDisplay(
  role: { level: StaffLevel; mandays: number },
  effectiveRate: (level: StaffLevel) => number,
): string {
  const rate = effectiveRate(role.level);
  if (rate <= 0) {
    return "—";
  }
  return formatAmount(role.mandays * rate);
}

function TaskRows({
  task,
  effectiveRate,
}: {
  task: TaskResult;
  effectiveRate: (level: StaffLevel) => number;
}) {
  // Task dengan satu role: tampilkan judul + rincian pada baris yang sama untuk ringkas.
  // Task dengan >1 role: tampilkan judul task, lalu satu baris untuk tiap role.
  const isSingleRole = task.roles.length === 1;

  if (isSingleRole) {
    const role = task.roles[0];
    return (
      <tr className="border-t border-ink/10">
        <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
          {task.taskName}
          {role.outOfRange && <OutOfRangeBadge />}
        </th>
        <td className="px-4 py-2 text-right tabular-nums text-ink">
          {formatMandays(role.mandays)}
        </td>
        <td className="px-4 py-2 text-ink">{staffLevelLabel(role.level)}</td>
        <td className="px-4 py-2 text-right tabular-nums text-ink">
          {roleCostDisplay(role, effectiveRate)}
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* Baris judul task (multi-role): total mandays seluruh role task. */}
      <tr className="border-t border-ink/10 bg-cream/30">
        <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
          {task.taskName}
        </th>
        <td className="px-4 py-2 text-right tabular-nums font-medium text-ink">
          {formatMandays(task.totalMandays)}
        </td>
        <td className="px-4 py-2 text-xs text-ink/60">
          {task.roles.length} role
        </td>
        {/* Biaya ditampilkan per role pada sub-baris di bawah. */}
        <td className="px-4 py-2" aria-hidden="true" />
      </tr>
      {/* Sub-baris per role. */}
      {task.roles.map((role, idx) => (
        <tr key={`${task.taskId}-${idx}`} className="border-t border-ink/5">
          <th
            scope="row"
            className="px-4 py-1.5 pl-8 text-left font-normal text-ink/80"
          >
            ↳ {staffLevelLabel(role.level)}
            {role.outOfRange && <OutOfRangeBadge />}
          </th>
          <td className="px-4 py-1.5 text-right tabular-nums text-ink/80">
            {formatMandays(role.mandays)}
          </td>
          <td className="px-4 py-1.5 text-ink/80">{staffLevelLabel(role.level)}</td>
          <td className="px-4 py-1.5 text-right tabular-nums text-ink/80">
            {roleCostDisplay(role, effectiveRate)}
          </td>
        </tr>
      ))}
    </>
  );
}

// Penanda visual bila jawaban di luar rentang tier (per role) (Req 3.5).
function OutOfRangeBadge() {
  return (
    <span
      className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
      title="Jawaban di luar rentang tier, memakai tier default."
    >
      di luar rentang
    </span>
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
