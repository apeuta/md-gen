"use client";

// AppShell — kerangka utama aplikasi yang merakit seluruh komponen (Req 1, 2, 5, 6, 7, 8).
//
// Tanggung jawab:
// - Header aplikasi dengan judul.
// - Navigasi dua mode utama: "Estimasi" dan "Konfigurasi" (tab/toggle) — Req 7, 8.
// - Mode Estimasi: stepper 3 langkah berurutan (Pilih → Kuisioner → Hasil) dengan
//   tombol navigasi Next/Back dan klik langsung ke langkah — Req 1, 2, 5, 6.
// - Mode Konfigurasi: menampilkan ConfigEditor + ImportExportPanel — Req 7, 8.
//
// Catatan hydration: seluruh state UI (mode & langkah) dikelola via useState di komponen
// client ini. State awal identik antara render server dan client pertama sehingga tidak
// menimbulkan mismatch. ConfigProvider sendiri dibungkus di layout.

import { useState } from "react";

import { TaskSelector } from "./TaskSelector";
import { Questionnaire } from "./Questionnaire";
import { ResultsTable } from "./ResultsTable";
import { RatePanel } from "./RatePanel";
import { ConfigEditor, type ConfigSubTab } from "./ConfigEditor";

// ============================================================================
// Tipe & konstanta navigasi
// ============================================================================

// Dua mode utama aplikasi.
type Mode = "estimasi" | "konfigurasi";

// Langkah pada mode Estimasi (stepper 3 langkah).
type Step = 0 | 1 | 2;

// Definisi sub-tab pada mode Konfigurasi (label + nilai).
const CONFIG_SUB_TABS: { value: ConfigSubTab; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "kuisioner", label: "Kuisioner" },
  { value: "impor", label: "Import/Export" },
];

// Definisi langkah stepper untuk render label & navigasi.
const STEPS: { label: string; description: string }[] = [
  { label: "Pilih", description: "Pilih kategori & task" },
  { label: "Kuisioner", description: "Jawab pertanyaan" },
  { label: "Hasil", description: "Lihat hasil & rate" },
];

// ============================================================================
// Komponen utama
// ============================================================================

export function AppShell() {
  // Mode aktif: default ke Estimasi karena itu alur utama pengguna.
  const [mode, setMode] = useState<Mode>("estimasi");
  // Langkah aktif pada mode Estimasi.
  const [step, setStep] = useState<Step>(0);
  // Sub-tab aktif pada mode Konfigurasi. Default "task".
  const [configSubTab, setConfigSubTab] = useState<ConfigSubTab>("task");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Header aplikasi */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Mandays Generator
        </h1>
        <p className="mt-1 text-sm text-ink/70">
          Susun estimasi mandays project: pilih task, jawab kuisioner, lihat hasil,
          lalu atur rate. Konfigurasi dapat diedit dan di-import/export.
        </p>
      </header>

      {/* Navigasi mode (tab). role="tablist" untuk aksesibilitas. */}
      <nav
        role="tablist"
        aria-label="Mode aplikasi"
        className="flex gap-2 border-b border-ink/15"
      >
        <ModeTab
          label="Estimasi"
          active={mode === "estimasi"}
          controls="panel-estimasi"
          onClick={() => setMode("estimasi")}
        />
        <ModeTab
          label="Konfigurasi"
          active={mode === "konfigurasi"}
          controls="panel-konfigurasi"
          onClick={() => setMode("konfigurasi")}
        />
      </nav>

      {/* Panel mode Estimasi */}
      {mode === "estimasi" && (
        <div
          id="panel-estimasi"
          role="tabpanel"
          aria-label="Mode Estimasi"
          className="flex flex-col gap-6"
        >
          <Stepper current={step} onSelect={(s) => setStep(s)} />

          {/* Konten langkah aktif */}
          <div>
            {step === 0 && <TaskSelector />}
            {step === 1 && <Questionnaire />}
            {step === 2 && (
              <div className="flex flex-col gap-8">
                <ResultsTable />
                <RatePanel />
              </div>
            )}
          </div>

          {/* Navigasi Back/Next antar langkah */}
          <StepNav current={step} onChange={(s) => setStep(s)} />
        </div>
      )}

      {/* Panel mode Konfigurasi */}
      {mode === "konfigurasi" && (
        <div
          id="panel-konfigurasi"
          role="tabpanel"
          aria-label="Mode Konfigurasi"
          className="flex flex-col gap-6"
        >
          {/* Navigasi sub-tab konfigurasi (Task / Kuisioner / Import-Export). */}
          <div
            role="tablist"
            aria-label="Sub-menu konfigurasi"
            className="flex gap-2 border-b border-ink/15"
          >
            {CONFIG_SUB_TABS.map((tab) => (
              <SubTab
                key={tab.value}
                label={tab.label}
                active={configSubTab === tab.value}
                controls={`subpanel-${tab.value}`}
                onClick={() => setConfigSubTab(tab.value)}
              />
            ))}
          </div>

          {/* Panel sub-tab aktif. ConfigEditor merender bagian sesuai activeSubTab
              (Task/Kuisioner memakai draft & tombol Simpan; Import/Export memakai
              context sendiri). */}
          <div
            id={`subpanel-${configSubTab}`}
            role="tabpanel"
            aria-label={`Konfigurasi ${configSubTab}`}
          >
            <ConfigEditor activeSubTab={configSubTab} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-komponen: tab mode
// ============================================================================

interface ModeTabProps {
  label: string;
  active: boolean;
  controls: string;
  onClick: () => void;
}

function ModeTab({ label, active, controls, onClick }: ModeTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-ink/50 hover:text-ink/80"
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Sub-komponen: sub-tab konfigurasi (gaya konsisten dengan ModeTab)
// ============================================================================

interface SubTabProps {
  label: string;
  active: boolean;
  controls: string;
  onClick: () => void;
}

function SubTab({ label, active, controls, onClick }: SubTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-ink/50 hover:text-ink/80"
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Sub-komponen: stepper (indikator + klik langsung ke langkah)
// ============================================================================

interface StepperProps {
  current: Step;
  onSelect: (step: Step) => void;
}

function Stepper({ current, onSelect }: StepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((item, index) => {
        const stepIndex = index as Step;
        const active = stepIndex === current;
        const completed = stepIndex < current;
        return (
          <li key={item.label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(stepIndex)}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
                active
                  ? "border-ink bg-ink text-cream"
                  : completed
                    ? "border-ink/30 bg-white/70 text-ink"
                    : "border-ink/20 bg-white/50 text-ink/60 hover:text-ink/80"
              }`}
            >
              {/* Nomor langkah dalam lingkaran kecil */}
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  active ? "bg-cream text-ink" : "bg-ink/10 text-ink/70"
                }`}
              >
                {index + 1}
              </span>
              <span>{item.label}</span>
            </button>
            {/* Garis penghubung antar langkah (kecuali langkah terakhir) */}
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="text-ink/30">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================================
// Sub-komponen: navigasi Back/Next
// ============================================================================

interface StepNavProps {
  current: Step;
  onChange: (step: Step) => void;
}

function StepNav({ current, onChange }: StepNavProps) {
  const isFirst = current === 0;
  const isLast = current === STEPS.length - 1;

  return (
    <div className="flex items-center justify-between border-t border-ink/10 pt-4">
      <button
        type="button"
        onClick={() => !isFirst && onChange((current - 1) as Step)}
        disabled={isFirst}
        className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Kembali
      </button>

      {/* Keterangan langkah saat ini */}
      <span className="text-xs text-ink/50">
        Langkah {current + 1} dari {STEPS.length}: {STEPS[current].description}
      </span>

      <button
        type="button"
        onClick={() => !isLast && onChange((current + 1) as Step)}
        disabled={isLast}
        className="rounded-md border border-ink/30 bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Lanjut →
      </button>
    </div>
  );
}

export default AppShell;
