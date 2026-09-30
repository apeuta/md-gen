"use client";

// Context penyedia state global aplikasi Mandays Generator.
//
// Memisahkan dua jenis state (lihat design.md "Pemisahan State: Config vs Session"):
// - Config (persisted): definisi kategori, task, variabel, tier, pertanyaan, dan rate.
//   Disimpan di localStorage melalui Persistence Layer (Req 8.1, 8.2).
// - Session (ephemeral): task yang dipilih (selectedTaskIds) dan jawaban kuisioner
//   (answers) untuk estimasi saat ini. Disimpan di memori saja (Req 1.3, 2.5).
//
// Catatan hydration Next.js: state config awal SELALU diinisialisasi dengan seed
// (createSeedConfig) sehingga render server dan render client pertama identik.
// Baru setelah mount, useEffect memuat config dari localStorage (loadConfig).
// Pendekatan ini menghindari mismatch SSR/CSR akibat localStorage yang tidak ada di server.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { AppConfig, StaffLevel } from "../lib/types";
import { createSeedConfig } from "../lib/seed";
import {
  exportConfig as exportConfigToFile,
  importConfigFromFile,
  loadConfig,
  parseImportedConfig,
  resetConfig as resetConfigToSeed,
  saveConfig,
  type ImportResult,
} from "../lib/persistence";

// ============================================================================
// Konstanta
// ============================================================================

// Jeda debounce ringan (ms) untuk auto-save config ke localStorage.
// Menghindari penulisan beruntun saat pengguna mengedit config secara cepat (Req 8.1).
const SAVE_DEBOUNCE_MS = 300;

// ============================================================================
// Bentuk nilai context
// ============================================================================

// Nilai yang diekspos context ke seluruh komponen.
export interface AppContextValue {
  // --- Config (persisted) ---
  config: AppConfig;

  // --- Session (ephemeral) ---
  selectedTaskIds: Set<string>;
  answers: Record<string, string | number>;

  // --- Status hydration ---
  // True setelah config selesai dimuat dari localStorage saat mount.
  // Komponen dapat memakainya untuk menghindari flash seed sebelum load.
  hydrated: boolean;

  // --- Mutasi config ---
  // Mengganti seluruh config (misalnya dari editor). Menerima nilai baru atau updater.
  setConfig: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  // Mengatur rate untuk satu level; nilai undefined menghapus rate level tersebut.
  setRate: (level: StaffLevel, value: number | undefined) => void;
  // Mengganti config aktif dengan seed data (Req 8.6).
  resetConfig: () => void;
  // Mengunduh config aktif sebagai file JSON (Req 8.3).
  exportConfig: () => void;
  // Import config dari File; mengembalikan hasil agar UI dapat menampilkan error (Req 8.4, 8.5).
  importConfig: (file: File) => Promise<ImportResult>;
  // Import config dari teks JSON (fungsi murni parse+validasi), sekaligus menerapkan bila valid.
  importConfigFromText: (text: string) => ImportResult;

  // --- Mutasi session ---
  // Menambah/menghapus satu task dari pilihan (Req 1.4, 1.5).
  toggleTask: (taskId: string) => void;
  // Mengeset status terpilih sekumpulan task sekaligus ("centang/kosongkan semua") (Req 1.7).
  setTasksSelected: (taskIds: string[], selected: boolean) => void;
  // Mengosongkan seluruh pilihan task.
  clearSelectedTasks: () => void;
  // Menyimpan jawaban sebuah pertanyaan (Req 2.5).
  setAnswer: (questionId: string, value: string | number) => void;
  // Menghapus jawaban sebuah pertanyaan (kembali ke default/tak terjawab).
  clearAnswer: (questionId: string) => void;
}

// Context internal; diakses melalui hook useAppContext/useConfig/useSession.
const AppContext = createContext<AppContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface ConfigProviderProps {
  children: ReactNode;
}

// ConfigProvider membungkus aplikasi dan menyediakan state Config + Session.
// Bertindak sebagai jembatan ke Persistence Layer (auto-load & auto-save).
export function ConfigProvider({ children }: ConfigProviderProps) {
  // Inisialisasi dengan seed agar render server & client pertama identik (anti hydration mismatch).
  const [config, setConfigState] = useState<AppConfig>(() => createSeedConfig());

  // Session state: ephemeral, tidak dipersist.
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [answers, setAnswers] = useState<Record<string, string | number>>({});

  // Penanda apakah config sudah dimuat dari localStorage.
  const [hydrated, setHydrated] = useState(false);

  // Ref timer untuk debounce auto-save.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Auto-load saat mount (Req 8.2) ---
  useEffect(() => {
    // loadConfig aman dipanggil di client: mengembalikan seed bila storage kosong/tidak tersedia.
    const loaded = loadConfig();
    setConfigState(loaded);
    setHydrated(true);
    // Sengaja hanya dijalankan sekali saat mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-save saat config berubah (Req 8.1) ---
  useEffect(() => {
    // Jangan simpan sebelum hydration selesai, agar seed awal tidak menimpa
    // config tersimpan sebelum sempat dimuat.
    if (!hydrated) {
      return;
    }

    // Debounce ringan: batalkan timer sebelumnya lalu jadwalkan simpan baru.
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveConfig(config);
      saveTimerRef.current = null;
    }, SAVE_DEBOUNCE_MS);

    // Bersihkan timer saat efek dijalankan ulang / unmount.
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [config, hydrated]);

  // ==========================================================================
  // Mutasi config
  // ==========================================================================

  const setConfig = useCallback(
    (next: AppConfig | ((prev: AppConfig) => AppConfig)) => {
      setConfigState((prev) =>
        typeof next === "function"
          ? (next as (prev: AppConfig) => AppConfig)(prev)
          : next,
      );
    },
    [],
  );

  const setRate = useCallback((level: StaffLevel, value: number | undefined) => {
    setConfigState((prev) => {
      const rates = { ...prev.rates };
      if (value === undefined || Number.isNaN(value)) {
        // Hapus rate agar diperlakukan sebagai nol oleh Calculation Engine (Req 6.3).
        delete rates[level];
      } else {
        rates[level] = value;
      }
      return { ...prev, rates };
    });
  }, []);

  const resetConfig = useCallback(() => {
    // Ganti config aktif dengan salinan seed (Req 8.6). Auto-save akan mempersist.
    setConfigState(resetConfigToSeed());
  }, []);

  const exportConfig = useCallback(() => {
    exportConfigToFile(config);
  }, [config]);

  const importConfig = useCallback(async (file: File): Promise<ImportResult> => {
    const result = await importConfigFromFile(file);
    // Terapkan hanya bila valid; bila gagal, state lama dipertahankan (Req 8.5).
    if ("config" in result) {
      setConfigState(result.config);
    }
    return result;
  }, []);

  const importConfigFromText = useCallback((text: string): ImportResult => {
    const result = parseImportedConfig(text);
    if ("config" in result) {
      setConfigState(result.config);
    }
    return result;
  }, []);

  // ==========================================================================
  // Mutasi session
  // ==========================================================================

  const toggleTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const setTasksSelected = useCallback(
    (taskIds: string[], selected: boolean) => {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        for (const id of taskIds) {
          if (selected) {
            next.add(id);
          } else {
            next.delete(id);
          }
        }
        return next;
      });
    },
    [],
  );

  const clearSelectedTasks = useCallback(() => {
    setSelectedTaskIds(new Set<string>());
  }, []);

  const setAnswer = useCallback(
    (questionId: string, value: string | number) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    [],
  );

  const clearAnswer = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  // ==========================================================================
  // Nilai context (memoized)
  // ==========================================================================

  const value = useMemo<AppContextValue>(
    () => ({
      config,
      selectedTaskIds,
      answers,
      hydrated,
      setConfig,
      setRate,
      resetConfig,
      exportConfig,
      importConfig,
      importConfigFromText,
      toggleTask,
      setTasksSelected,
      clearSelectedTasks,
      setAnswer,
      clearAnswer,
    }),
    [
      config,
      selectedTaskIds,
      answers,
      hydrated,
      setConfig,
      setRate,
      resetConfig,
      exportConfig,
      importConfig,
      importConfigFromText,
      toggleTask,
      setTasksSelected,
      clearSelectedTasks,
      setAnswer,
      clearAnswer,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

// Hook utama: mengembalikan seluruh nilai context.
// Melempar error yang jelas bila dipakai di luar ConfigProvider.
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (ctx === null) {
    throw new Error("useAppContext harus dipakai di dalam <ConfigProvider>.");
  }
  return ctx;
}

// Hook fokus Config (persisted) beserta fungsi mutasinya.
export function useConfig() {
  const {
    config,
    hydrated,
    setConfig,
    setRate,
    resetConfig,
    exportConfig,
    importConfig,
    importConfigFromText,
  } = useAppContext();
  return {
    config,
    hydrated,
    setConfig,
    setRate,
    resetConfig,
    exportConfig,
    importConfig,
    importConfigFromText,
  };
}

// Hook fokus Session (ephemeral) beserta fungsi mutasinya.
export function useSession() {
  const {
    selectedTaskIds,
    answers,
    toggleTask,
    setTasksSelected,
    clearSelectedTasks,
    setAnswer,
    clearAnswer,
  } = useAppContext();
  return {
    selectedTaskIds,
    answers,
    toggleTask,
    setTasksSelected,
    clearSelectedTasks,
    setAnswer,
    clearAnswer,
  };
}
