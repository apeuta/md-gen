// Persistence Layer aplikasi Mandays Generator.
// Bertanggung jawab atas:
// - Muat/simpan AppConfig ke localStorage (Req 8.1, 8.2)
// - Export config sebagai file JSON (Req 8.3)
// - Import config dari file JSON dengan validasi (Req 8.4, 8.5)
// - Reset ke seed data (Req 8.6)
// - Fallback aman bila localStorage tidak tersedia atau saat SSR (Req 8.6, penanganan error)
//
// Seluruh akses browser API (window, document, localStorage, FileReader) di-guard
// agar aman dijalankan di lingkungan tanpa DOM (SSR/Node) dan tidak pernah throw
// yang mematahkan aplikasi.

import type { AppConfig } from "./types";
import { validateConfig } from "./validation";
import { createSeedConfig } from "./seed";

// ============================================================================
// Konstanta
// ============================================================================

// Key localStorage untuk menyimpan konfigurasi aplikasi (Req 8.1).
export const STORAGE_KEY = "mandays-generator:config";

// Nama default file saat export JSON.
const EXPORT_FILE_NAME = "mandays-generator-config.json";

// ============================================================================
// Ketersediaan storage
// ============================================================================

// Mengecek apakah localStorage tersedia dan bisa ditulis.
// Mengembalikan false saat SSR (typeof window undefined) atau di mode privat
// yang memblokir akses storage. Tidak pernah throw (Req 8.6).
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    // Uji tulis/hapus untuk memastikan storage benar-benar bisa dipakai
    // (beberapa browser di mode privat tetap expose objek namun melempar saat setItem).
    const testKey = "__mandays_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Muat & simpan config
// ============================================================================

// Membaca config dari localStorage. Bila tidak ada, tidak valid (JSON rusak
// atau gagal validasi skema), atau storage tidak tersedia -> jatuh ke seed (Req 8.2, 9.3).
export function loadConfig(): AppConfig {
  if (!isStorageAvailable()) {
    return createSeedConfig();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw.length === 0) {
      // Tidak ada config tersimpan -> pakai seed.
      return createSeedConfig();
    }

    const parsed: unknown = JSON.parse(raw);
    const result = validateConfig(parsed);
    if (!result.valid) {
      // Config tersimpan rusak/tidak sesuai skema -> jatuh ke seed agar app tetap jalan.
      return createSeedConfig();
    }

    return parsed as AppConfig;
  } catch {
    // JSON rusak atau error akses storage -> fallback ke seed.
    return createSeedConfig();
  }
}

// Menyimpan config ke localStorage. Aman (no-op) bila storage tidak tersedia (Req 8.1, 8.6).
export function saveConfig(config: AppConfig): void {
  if (!isStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Kegagalan tulis (mis. kuota penuh) tidak boleh mematahkan aplikasi.
  }
}

// ============================================================================
// Export
// ============================================================================

// Memicu unduhan AppConfig sebagai file .json via Blob + anchor download (Req 8.3).
// Di-guard agar aman saat SSR / tanpa document (no-op bila tidak ada window/document).
export function exportConfig(
  config: AppConfig,
  fileName: string = EXPORT_FILE_NAME,
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  try {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();

    // Bersihkan elemen dan object URL agar tidak bocor memori.
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch {
    // Kegagalan export tidak boleh mematahkan aplikasi.
  }
}

// ============================================================================
// Import
// ============================================================================

// Tipe hasil parse import: sukses membawa config, gagal membawa daftar error.
export type ImportResult =
  | { config: AppConfig }
  | { errors: string[] };

// Fungsi murni: parse teks JSON lalu validasi via validateConfig.
// - JSON rusak -> { errors } (tanpa merusak state lama karena tidak menyentuh storage).
// - Config tidak valid -> { errors } dari hasil validasi.
// - Valid -> { config } (Req 8.4, 8.5).
// Dipisahkan dari FileReader agar mudah diuji sebagai fungsi murni.
export function parseImportedConfig(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { errors: ["File tidak dapat dibaca sebagai JSON yang valid."] };
  }

  const result = validateConfig(parsed);
  if (!result.valid) {
    return { errors: result.errors };
  }

  return { config: parsed as AppConfig };
}

// Membaca sebuah File (dari input upload) via FileReader, lalu parse + validasi.
// Mengembalikan Promise agar pemanggil dapat menampilkan error tanpa merusak
// state lama (Req 8.4, 8.5). Selalu resolve (tidak pernah reject) untuk memudahkan UI.
export function importConfigFromFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined") {
      resolve({ errors: ["Pembacaan file tidak didukung di lingkungan ini."] });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text =
        typeof reader.result === "string" ? reader.result : "";
      resolve(parseImportedConfig(text));
    };
    reader.onerror = () => {
      resolve({ errors: ["Gagal membaca file yang dipilih."] });
    };
    reader.readAsText(file);
  });
}

// ============================================================================
// Reset
// ============================================================================

// Mengembalikan salinan seed data sebagai config aktif (Req 8.6).
// Tidak menyentuh storage; pemanggil bertanggung jawab memanggil saveConfig bila perlu.
export function resetConfig(): AppConfig {
  return createSeedConfig();
}
