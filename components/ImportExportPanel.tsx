"use client";

// ImportExportPanel — UI untuk mengelola konfigurasi aktif secara keseluruhan (Req 8.3–8.6):
// - Export JSON: mengunduh config aktif sebagai berkas .json (Req 8.3).
// - Import JSON: mengunggah berkas .json, memvalidasi, lalu menerapkan bila valid (Req 8.4).
//   Bila tidak valid, error ditampilkan tanpa merusak config aktif (Req 8.5).
// - Reset ke seed: mengganti seluruh config aktif dengan seed data bawaan (Req 8.6).
//
// Komponen ini murni bersandar pada fungsi context (exportConfig, importConfig, resetConfig)
// dari useConfig sehingga tidak menyentuh Persistence Layer secara langsung. Dengan begitu
// auto-save di ConfigContext menangani persistensi setelah perubahan.

import { useRef, useState } from "react";

import { useConfig } from "../context/ConfigContext";
import { ChangePasswordPanel } from "./ChangePasswordPanel";

// ============================================================================
// Tipe status feedback
// ============================================================================

// Status hasil operasi import untuk menampilkan feedback ke pengguna.
// - idle: belum ada operasi / feedback dibersihkan.
// - success: import berhasil diterapkan.
// - error: import gagal, membawa daftar pesan error (tidak mengubah config aktif).
type ImportFeedback =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; errors: string[] };

// ============================================================================
// Komponen utama
// ============================================================================

export function ImportExportPanel() {
  // Fungsi mutasi config dari context (Req 8.3–8.6).
  const { exportConfig, importConfig, resetConfig } = useConfig();

  // Feedback hasil import (sukses/gagal) yang ditampilkan di bawah tombol.
  const [feedback, setFeedback] = useState<ImportFeedback>({ status: "idle" });

  // Penanda proses import sedang berjalan agar tombol/input bisa dinonaktifkan sementara.
  const [importing, setImporting] = useState(false);

  // Ref ke input file agar bisa direset nilainya setelah proses selesai.
  // Tanpa reset, memilih berkas yang sama dua kali berturut-turut tidak memicu onChange.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Export JSON (Req 8.3) ---
  function handleExport() {
    exportConfig();
  }

  // --- Import JSON (Req 8.4, 8.5) ---
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setFeedback({ status: "idle" });

    try {
      // importConfig menerapkan config hanya bila valid; bila gagal, config aktif
      // dipertahankan sepenuhnya (Req 8.5) dan kita cukup menampilkan error.
      const result = await importConfig(file);
      if ("config" in result) {
        setFeedback({
          status: "success",
          message: "Konfigurasi berhasil diimpor dan diterapkan.",
        });
      } else {
        setFeedback({ status: "error", errors: result.errors });
      }
    } finally {
      setImporting(false);
      // Reset input file agar berkas yang sama dapat dipilih ulang bila perlu.
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // --- Reset ke seed (Req 8.6) ---
  function handleReset() {
    // Konfirmasi ringan karena aksi ini mengganti SELURUH config aktif (MVP: window.confirm).
    const confirmed = window.confirm(
      "Reset konfigurasi ke seed data bawaan? Seluruh perubahan pada konfigurasi aktif akan hilang.",
    );
    if (!confirmed) {
      return;
    }
    resetConfig();
    setFeedback({
      status: "success",
      message: "Konfigurasi telah direset ke seed data bawaan.",
    });
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">Import / Export / Reset</h2>
        <p className="mt-1 text-sm text-ink/70">
          Ekspor konfigurasi aktif sebagai berkas JSON, impor dari berkas JSON, atau
          reset kembali ke seed data bawaan.
        </p>
      </header>

      <div className="rounded-lg border border-ink/20 bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Export JSON (Req 8.3) */}
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md border border-ink/30 bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-ink/30"
          >
            Export JSON
          </button>

          {/* Import JSON (Req 8.4). Label membungkus input file untuk aksesibilitas. */}
          <label className="inline-flex cursor-pointer items-center rounded-md border border-ink/30 bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream/70 focus-within:ring-2 focus-within:ring-ink/30">
            <span>{importing ? "Mengimpor…" : "Import JSON"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              disabled={importing}
              // Sembunyikan input bawaan namun tetap dapat diakses via label & keyboard.
              className="sr-only"
              aria-label="Pilih berkas JSON konfigurasi untuk diimpor"
            />
          </label>

          {/* Reset ke seed (Req 8.6) */}
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-ink/30 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-ink/30"
          >
            Reset ke seed
          </button>
        </div>

        {/* Feedback sukses: pengumuman non-intrusif via role="status". */}
        {feedback.status === "success" && (
          <p
            role="status"
            className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {feedback.message}
          </p>
        )}

        {/* Feedback error import: daftar pesan via role="alert" (Req 8.5). */}
        {feedback.status === "error" && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <p className="font-semibold">
              Impor ditolak. Konfigurasi aktif tidak diubah.
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {feedback.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-ink/60">
        Catatan: berkas import harus berupa JSON konfigurasi yang valid. Berkas yang
        tidak sesuai skema akan ditolak tanpa mengubah konfigurasi yang sedang aktif.
        Password admin TIDAK ikut dalam Export JSON (disimpan terpisah).
      </p>

      {/* Ganti password admin — hanya tampil saat sudah login sebagai admin. */}
      <ChangePasswordPanel />
    </section>
  );
}

export default ImportExportPanel;
