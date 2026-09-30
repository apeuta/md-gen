"use client";

// ExportCsvButton — tombol tunggal untuk mengekspor hasil estimasi ke CSV.
//
// Komponen kecil yang punya akses langsung ke context (useConfig + useSession),
// sehingga bisa menghitung EstimationResult sendiri via calculate(), lalu membangun
// CSV (buildCsv) dan mengunduhnya (downloadText). Dipakai di bar navigasi langkah
// Hasil menggantikan tombol "Lanjut" (lihat AppShell). Tombol dinonaktifkan bila
// belum ada task terpilih (result.perTask kosong).
//
// Rate override sesi diteruskan ke calculate agar CSV konsisten dengan tampilan.

import { useMemo } from "react";

import { useConfig, useSession } from "../context/ConfigContext";
import { calculate } from "../lib/calc";
import { buildCsv } from "../lib/csv";
import { downloadText } from "../lib/persistence";
import type { EstimationResult } from "../lib/types";

export function ExportCsvButton({ className }: { className?: string }) {
  const { config } = useConfig();
  const { selectedTaskIds, answers, rateOverrides } = useSession();

  // Hitung hasil secara reaktif; sama seperti di ResultsTable/RatePanel.
  const result: EstimationResult = useMemo(
    () => calculate({ config, selectedTaskIds, answers, rateOverrides }),
    [config, selectedTaskIds, answers, rateOverrides],
  );

  // Belum ada task terpilih -> tombol dinonaktifkan.
  const isEmpty = result.perTask.length === 0;

  function handleExportCsv() {
    const csv = buildCsv(result, config);
    downloadText(csv, "estimasi-mandays.csv", "text/csv;charset=utf-8");
  }

  return (
    <button
      type="button"
      onClick={handleExportCsv}
      disabled={isEmpty}
      aria-disabled={isEmpty}
      title={
        isEmpty
          ? "Pilih minimal satu task terlebih dahulu untuk mengekspor CSV."
          : "Unduh hasil estimasi sebagai berkas CSV."
      }
      className={
        className ??
        "rounded-md border border-ink/30 bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      Export CSV
    </button>
  );
}

export default ExportCsvButton;
