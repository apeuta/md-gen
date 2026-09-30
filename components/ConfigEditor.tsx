"use client";

// ConfigEditor — UI mode Konfigurasi: CRUD kategori, task, variabel, dan tier (Req 7).
//
// Fungsi utama:
// - Menampilkan seluruh kategori & task dari config aktif dalam bentuk DRAFT lokal
//   yang dapat diedit bebas tanpa langsung memengaruhi config aktif.
// - CRUD kategori: tambah, rename, hapus (Req 7.1, 7.4).
// - CRUD task dalam kategori: tambah, hapus; edit name, baselineMandays, defaultLevel (Req 7.2, 7.3, 7.4).
// - Editor variabel task (opsional): pilih questionId dari daftar pertanyaan yang ADA,
//   set defaultTierId, serta CRUD tier (id, label, min, max, matchOptions, mandays, levelShift) (Req 7.3).
// - Tombol "Simpan" menjalankan validateConfig(draft); bila TIDAK valid, menampilkan
//   daftar error field-spesifik dan TIDAK memanggil setConfig (Req 7.6). Bila valid,
//   commit ke config context dan tampilkan pesan sukses.
// - Tombol "Batalkan perubahan" mengembalikan draft ke config aktif.
//
// Catatan: editor pertanyaan (buat/ubah teks & opsi pertanyaan) adalah task 10.2.
// Di sini pengguna hanya MEMILIH questionId yang sudah tersedia pada config.questions.

import { useEffect, useMemo, useState } from "react";

import { useConfig } from "../context/ConfigContext";
import { ALL_STAFF_LEVELS } from "../lib/calc";
import { validateConfig } from "../lib/validation";
import { STAFF_LEVEL_LABELS, staffLevelLabel } from "../lib/types";
import type {
  AppConfig,
  Category,
  Question,
  StaffLevel,
  Task,
  TaskVariable,
  Tier,
} from "../lib/types";
import { QuestionEditor } from "./QuestionEditor";

// ============================================================================
// Utilitas id sederhana (MVP, tanpa dependensi eksternal)
// ============================================================================

// Membuat slug dari teks (huruf kecil, spasi/karakter non-alfanumerik -> tanda hubung).
// Dipakai sebagai basis id yang mudah dibaca.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Membuat id acak pendek sebagai penjamin keunikan (fallback bila slug kosong/duplikat).
function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

// Membuat id unik dengan prefix + slug opsional, dijamin belum ada di set `existing`.
function uniqueId(prefix: string, label: string, existing: Set<string>): string {
  const base = slugify(label);
  let candidate = base ? `${prefix}-${base}` : `${prefix}-${shortId()}`;
  // Bila bentrok, tambahkan suffix acak sampai unik.
  while (existing.has(candidate)) {
    candidate = `${prefix}-${base ? base + "-" : ""}${shortId()}`;
  }
  return candidate;
}

// Mengumpulkan seluruh id kategori, task, tier, & pertanyaan pada draft untuk cek keunikan id baru.
function collectIds(config: AppConfig): Set<string> {
  const ids = new Set<string>();
  for (const cat of config.categories) {
    ids.add(cat.id);
    for (const t of cat.tasks) {
      ids.add(t.id);
      if (t.variable) {
        for (const tier of t.variable.tiers) {
          ids.add(tier.id);
        }
      }
    }
  }
  // Sertakan id pertanyaan agar id baru (task/kategori/tier/pertanyaan) tidak bentrok.
  for (const q of config.questions) {
    ids.add(q.id);
  }
  return ids;
}

// Deep clone config agar draft aman dimutasi tanpa memengaruhi config aktif.
function cloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig;
}

// ============================================================================
// Kelas utility styling yang dipakai berulang
// ============================================================================

const inputClass =
  "rounded-md border border-ink/20 bg-white px-2 py-1 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/20";
const labelClass = "text-xs font-medium text-ink/70";
const btnBase =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ink/20";
const btnPrimary = `${btnBase} bg-ink text-cream hover:bg-ink/90`;
const btnGhost = `${btnBase} border border-ink/20 text-ink hover:bg-ink/5`;
const btnDanger = `${btnBase} border border-red-300 text-red-700 hover:bg-red-50`;

// ============================================================================
// Komponen utama
// ============================================================================

export function ConfigEditor() {
  const { config, setConfig } = useConfig();

  // Draft lokal yang diedit pengguna, diinisialisasi dari config aktif.
  const [draft, setDraft] = useState<AppConfig>(() => cloneConfig(config));
  // Daftar error validasi terakhir (kosong bila belum simpan / valid).
  const [errors, setErrors] = useState<string[]>([]);
  // Pesan sukses setelah simpan berhasil.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Sinkronkan draft bila config aktif berubah dari luar (mis. import/reset).
  // Reset draft ke config baru dan bersihkan status.
  useEffect(() => {
    setDraft(cloneConfig(config));
    setErrors([]);
    setSavedMessage(null);
  }, [config]);

  // Apakah draft berbeda dari config aktif (untuk indikator "belum disimpan").
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(config),
    [draft, config],
  );

  // ==========================================================================
  // Helper mutasi draft
  // ==========================================================================

  // Mengganti satu kategori berdasarkan indeks dengan hasil fungsi updater.
  function updateCategory(catIdx: number, updater: (cat: Category) => Category) {
    setDraft((prev) => {
      const categories = prev.categories.map((c, i) =>
        i === catIdx ? updater(c) : c,
      );
      return { ...prev, categories };
    });
  }

  // Mengganti satu task pada kategori tertentu dengan hasil fungsi updater.
  function updateTask(
    catIdx: number,
    taskIdx: number,
    updater: (task: Task) => Task,
  ) {
    updateCategory(catIdx, (cat) => ({
      ...cat,
      tasks: cat.tasks.map((t, i) => (i === taskIdx ? updater(t) : t)),
    }));
  }

  // --- Kategori ---

  function addCategory() {
    setDraft((prev) => {
      const existing = collectIds(prev);
      const id = uniqueId("cat", "kategori baru", existing);
      const newCat: Category = { id, name: "Kategori Baru", tasks: [] };
      return { ...prev, categories: [...prev.categories, newCat] };
    });
  }

  function renameCategory(catIdx: number, name: string) {
    updateCategory(catIdx, (cat) => ({ ...cat, name }));
  }

  function removeCategory(catIdx: number) {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== catIdx),
    }));
  }

  // --- Task ---

  function addTask(catIdx: number) {
    setDraft((prev) => {
      const existing = collectIds(prev);
      const id = uniqueId("t", "task baru", existing);
      const newTask: Task = {
        id,
        name: "Task Baru",
        baselineMandays: 1,
        defaultLevel: "GENERAL_ENGINEER",
      };
      const categories = prev.categories.map((c, i) =>
        i === catIdx ? { ...c, tasks: [...c.tasks, newTask] } : c,
      );
      return { ...prev, categories };
    });
  }

  function removeTask(catIdx: number, taskIdx: number) {
    updateCategory(catIdx, (cat) => ({
      ...cat,
      tasks: cat.tasks.filter((_, i) => i !== taskIdx),
    }));
  }

  function renameTask(catIdx: number, taskIdx: number, name: string) {
    updateTask(catIdx, taskIdx, (t) => ({ ...t, name }));
  }

  function setTaskBaseline(catIdx: number, taskIdx: number, raw: string) {
    // Simpan sebagai angka; string kosong dianggap 0. Validasi non-negatif dilakukan saat simpan.
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    updateTask(catIdx, taskIdx, (t) => ({
      ...t,
      baselineMandays: Number.isNaN(parsed) ? t.baselineMandays : parsed,
    }));
  }

  function setTaskLevel(catIdx: number, taskIdx: number, level: StaffLevel) {
    updateTask(catIdx, taskIdx, (t) => ({ ...t, defaultLevel: level }));
  }

  // --- Variabel task ---

  // Menambahkan variabel default pada task (dengan satu tier awal sebagai default).
  function addVariable(catIdx: number, taskIdx: number) {
    setDraft((prev) => {
      const existing = collectIds(prev);
      const firstQuestionId = prev.questions[0]?.id ?? "";
      const tierId = uniqueId("tier", "default", existing);
      const variable: TaskVariable = {
        questionId: firstQuestionId,
        defaultTierId: tierId,
        tiers: [
          {
            id: tierId,
            label: "Default",
            min: null,
            max: null,
            mandays: 0,
          },
        ],
      };
      const categories = prev.categories.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              tasks: c.tasks.map((t, j) =>
                j === taskIdx ? { ...t, variable } : t,
              ),
            }
          : c,
      );
      return { ...prev, categories };
    });
  }

  // Menghapus variabel dari task (task kembali memakai baseline).
  function removeVariable(catIdx: number, taskIdx: number) {
    updateTask(catIdx, taskIdx, (t) => {
      const { variable: _drop, ...rest } = t;
      return { ...rest };
    });
  }

  function setVariableQuestion(
    catIdx: number,
    taskIdx: number,
    questionId: string,
  ) {
    updateTask(catIdx, taskIdx, (t) =>
      t.variable ? { ...t, variable: { ...t.variable, questionId } } : t,
    );
  }

  function setVariableDefaultTier(
    catIdx: number,
    taskIdx: number,
    tierId: string,
  ) {
    updateTask(catIdx, taskIdx, (t) =>
      t.variable ? { ...t, variable: { ...t.variable, defaultTierId: tierId } } : t,
    );
  }

  // --- Tier ---

  function addTier(catIdx: number, taskIdx: number) {
    setDraft((prev) => {
      const existing = collectIds(prev);
      const tierId = uniqueId("tier", "baru", existing);
      const newTier: Tier = {
        id: tierId,
        label: "Tier Baru",
        min: null,
        max: null,
        mandays: 0,
      };
      const categories = prev.categories.map((c, i) => {
        if (i !== catIdx) return c;
        return {
          ...c,
          tasks: c.tasks.map((t, j) => {
            if (j !== taskIdx || !t.variable) return t;
            return {
              ...t,
              variable: {
                ...t.variable,
                tiers: [...t.variable.tiers, newTier],
              },
            };
          }),
        };
      });
      return { ...prev, categories };
    });
  }

  function removeTier(catIdx: number, taskIdx: number, tierIdx: number) {
    updateTask(catIdx, taskIdx, (t) => {
      if (!t.variable) return t;
      const tiers = t.variable.tiers.filter((_, i) => i !== tierIdx);
      // Bila defaultTierId menunjuk tier yang dihapus, alihkan ke tier pertama tersisa.
      const removedId = t.variable.tiers[tierIdx]?.id;
      const defaultTierId =
        t.variable.defaultTierId === removedId
          ? tiers[0]?.id ?? ""
          : t.variable.defaultTierId;
      return { ...t, variable: { ...t.variable, tiers, defaultTierId } };
    });
  }

  // Mengubah satu field tier dengan hasil fungsi updater.
  function updateTier(
    catIdx: number,
    taskIdx: number,
    tierIdx: number,
    updater: (tier: Tier) => Tier,
  ) {
    updateTask(catIdx, taskIdx, (t) => {
      if (!t.variable) return t;
      const tiers = t.variable.tiers.map((tier, i) =>
        i === tierIdx ? updater(tier) : tier,
      );
      return { ...t, variable: { ...t.variable, tiers } };
    });
  }

  // Parse nilai numeric bertoleransi kosong -> null (batas tak terbatas).
  function parseNullableNumber(raw: string): number | null {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  // --- Pertanyaan (kuisioner) ---
  // Semua mutasi memakai state draft yang sama sehingga ikut divalidasi & disimpan
  // lewat handleSave, dan pertanyaan baru otomatis muncul di dropdown editor task.

  // Menambahkan pertanyaan baru. Default: single_choice dengan opsi kosong,
  // categoryId mengikuti kategori pertama (bila ada).
  function addQuestion() {
    setDraft((prev) => {
      const existing = collectIds(prev);
      const id = uniqueId("q", "pertanyaan baru", existing);
      const firstCategoryId = prev.categories[0]?.id ?? "";
      const newQuestion: Question = {
        id,
        categoryId: firstCategoryId,
        text: "Pertanyaan Baru",
        type: "single_choice",
        options: [],
      };
      return { ...prev, questions: [...prev.questions, newQuestion] };
    });
  }

  function removeQuestion(questionIdx: number) {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== questionIdx),
    }));
  }

  // Mengganti satu pertanyaan berdasarkan indeks dengan hasil fungsi updater.
  function updateQuestion(
    questionIdx: number,
    updater: (question: Question) => Question,
  ) {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === questionIdx ? updater(q) : q,
      ),
    }));
  }

  // ==========================================================================
  // Aksi simpan & batal
  // ==========================================================================

  // Memvalidasi draft; commit bila valid, tampilkan error field-spesifik bila tidak (Req 7.6).
  function handleSave() {
    const validation = validateConfig(draft);
    if (!validation.valid) {
      // Tolak simpan: tampilkan error field-spesifik, JANGAN commit ke config (Req 7.6).
      setErrors(validation.errors);
      setSavedMessage(null);
      return;
    }
    // Valid: commit ke config context (auto-persist oleh provider).
    setErrors([]);
    setConfig(cloneConfig(draft));
    setSavedMessage("Konfigurasi berhasil disimpan.");
  }

  function handleCancel() {
    // Kembalikan draft ke config aktif dan bersihkan status.
    setDraft(cloneConfig(config));
    setErrors([]);
    setSavedMessage(null);
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Konfigurasi Task</h2>
          <p className="mt-1 text-sm text-ink/70">
            Kelola kategori, task, variabel, dan tier. Perubahan hanya tersimpan
            setelah ditekan Simpan dan lolos validasi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={btnGhost} onClick={addCategory}>
            + Kategori
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={handleCancel}
            disabled={!isDirty}
            aria-disabled={!isDirty}
          >
            Batalkan perubahan
          </button>
          <button type="button" className={btnPrimary} onClick={handleSave}>
            Simpan
          </button>
        </div>
      </header>

      {/* Indikator perubahan belum disimpan */}
      {isDirty && errors.length === 0 && savedMessage === null && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ada perubahan yang belum disimpan.
        </p>
      )}

      {/* Daftar error validasi (Req 7.6) */}
      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <p className="font-semibold">
            Gagal menyimpan: perbaiki {errors.length} masalah berikut.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pesan sukses */}
      {savedMessage && (
        <p
          role="status"
          className="mb-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {savedMessage}
        </p>
      )}

      {/* Daftar kategori */}
      <div className="flex flex-col gap-4">
        {draft.categories.length === 0 && (
          <p className="rounded-md border border-dashed border-ink/20 px-4 py-6 text-center text-sm text-ink/60">
            Belum ada kategori. Tambahkan kategori untuk mulai.
          </p>
        )}

        {draft.categories.map((category, catIdx) => (
          <div
            key={category.id}
            className="rounded-lg border border-ink/20 bg-white/70 p-4"
          >
            {/* Header kategori: rename + hapus + tambah task */}
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`cat-name-${category.id}`}
                  className={labelClass}
                >
                  Nama kategori
                </label>
                <input
                  id={`cat-name-${category.id}`}
                  type="text"
                  value={category.name}
                  onChange={(e) => renameCategory(catIdx, e.target.value)}
                  className={`${inputClass} w-72`}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => addTask(catIdx)}
                >
                  + Task
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => removeCategory(catIdx)}
                >
                  Hapus kategori
                </button>
              </div>
            </div>

            {/* Daftar task */}
            <div className="flex flex-col gap-3">
              {category.tasks.length === 0 && (
                <p className="text-sm text-ink/50">Belum ada task.</p>
              )}

              {category.tasks.map((task, taskIdx) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  questions={draft.questions}
                  onRename={(name) => renameTask(catIdx, taskIdx, name)}
                  onBaselineChange={(raw) =>
                    setTaskBaseline(catIdx, taskIdx, raw)
                  }
                  onLevelChange={(level) => setTaskLevel(catIdx, taskIdx, level)}
                  onRemove={() => removeTask(catIdx, taskIdx)}
                  onAddVariable={() => addVariable(catIdx, taskIdx)}
                  onRemoveVariable={() => removeVariable(catIdx, taskIdx)}
                  onQuestionChange={(qid) =>
                    setVariableQuestion(catIdx, taskIdx, qid)
                  }
                  onDefaultTierChange={(tid) =>
                    setVariableDefaultTier(catIdx, taskIdx, tid)
                  }
                  onAddTier={() => addTier(catIdx, taskIdx)}
                  onRemoveTier={(tierIdx) =>
                    removeTier(catIdx, taskIdx, tierIdx)
                  }
                  onTierChange={(tierIdx, updater) =>
                    updateTier(catIdx, taskIdx, tierIdx, updater)
                  }
                  parseNullableNumber={parseNullableNumber}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Editor kuisioner (Req 7.5) — mengedit draft.questions yang sama */}
      <QuestionEditor
        questions={draft.questions}
        categories={draft.categories}
        onAddQuestion={addQuestion}
        onRemoveQuestion={removeQuestion}
        onQuestionChange={updateQuestion}
      />
    </section>
  );
}

// ============================================================================
// Sub-komponen: baris task (task + variabel + tier)
// ============================================================================

interface TaskRowProps {
  task: Task;
  questions: AppConfig["questions"];
  onRename: (name: string) => void;
  onBaselineChange: (raw: string) => void;
  onLevelChange: (level: StaffLevel) => void;
  onRemove: () => void;
  onAddVariable: () => void;
  onRemoveVariable: () => void;
  onQuestionChange: (questionId: string) => void;
  onDefaultTierChange: (tierId: string) => void;
  onAddTier: () => void;
  onRemoveTier: (tierIdx: number) => void;
  onTierChange: (tierIdx: number, updater: (tier: Tier) => Tier) => void;
  parseNullableNumber: (raw: string) => number | null;
}

function TaskRow({
  task,
  questions,
  onRename,
  onBaselineChange,
  onLevelChange,
  onRemove,
  onAddVariable,
  onRemoveVariable,
  onQuestionChange,
  onDefaultTierChange,
  onAddTier,
  onRemoveTier,
  onTierChange,
  parseNullableNumber,
}: TaskRowProps) {
  return (
    <div className="rounded-md border border-ink/10 bg-cream/40 p-3">
      {/* Atribut dasar task */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`task-name-${task.id}`} className={labelClass}>
            Nama task
          </label>
          <input
            id={`task-name-${task.id}`}
            type="text"
            value={task.name}
            onChange={(e) => onRename(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`task-baseline-${task.id}`} className={labelClass}>
            Baseline mandays
          </label>
          <input
            id={`task-baseline-${task.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={task.baselineMandays}
            onChange={(e) => onBaselineChange(e.target.value)}
            className={`${inputClass} w-32 text-right tabular-nums`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`task-level-${task.id}`} className={labelClass}>
            Level default
          </label>
          <select
            id={`task-level-${task.id}`}
            value={task.defaultLevel}
            onChange={(e) => onLevelChange(e.target.value as StaffLevel)}
            className={`${inputClass} w-40`}
          >
            {ALL_STAFF_LEVELS.map((level) => (
              <option key={level} value={level}>
                {STAFF_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className={btnDanger} onClick={onRemove}>
          Hapus task
        </button>
      </div>

      {/* Bagian variabel */}
      <div className="mt-3 border-t border-ink/10 pt-3">
        {!task.variable ? (
          <button
            type="button"
            className={btnGhost}
            onClick={onAddVariable}
          >
            + Tambah variabel (tier)
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`var-question-${task.id}`}
                    className={labelClass}
                  >
                    Pertanyaan (questionId)
                  </label>
                  <select
                    id={`var-question-${task.id}`}
                    value={task.variable.questionId}
                    onChange={(e) => onQuestionChange(e.target.value)}
                    className={`${inputClass} w-64`}
                  >
                    {/* Opsi kosong bila belum ada pertanyaan tersedia */}
                    {questions.length === 0 && (
                      <option value="">(belum ada pertanyaan)</option>
                    )}
                    {questions.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.text} [{q.id}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`var-default-tier-${task.id}`}
                    className={labelClass}
                  >
                    Tier default
                  </label>
                  <select
                    id={`var-default-tier-${task.id}`}
                    value={task.variable.defaultTierId}
                    onChange={(e) => onDefaultTierChange(e.target.value)}
                    className={`${inputClass} w-48`}
                  >
                    {task.variable.tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.label} [{tier.id}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className={btnGhost} onClick={onAddTier}>
                  + Tier
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  onClick={onRemoveVariable}
                >
                  Hapus variabel
                </button>
              </div>
            </div>

            {/* Daftar tier */}
            <div className="flex flex-col gap-2">
              {task.variable.tiers.map((tier, tierIdx) => (
                <div
                  key={tier.id}
                  className="flex flex-wrap items-end gap-2 rounded-md border border-ink/10 bg-white/60 p-2"
                >
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`tier-label-${tier.id}`}
                      className={labelClass}
                    >
                      Label
                    </label>
                    <input
                      id={`tier-label-${tier.id}`}
                      type="text"
                      value={tier.label}
                      onChange={(e) =>
                        onTierChange(tierIdx, (t) => ({
                          ...t,
                          label: e.target.value,
                        }))
                      }
                      className={`${inputClass} w-36`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`tier-min-${tier.id}`}
                      className={labelClass}
                    >
                      Min
                    </label>
                    <input
                      id={`tier-min-${tier.id}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={tier.min ?? ""}
                      placeholder="∞"
                      onChange={(e) =>
                        onTierChange(tierIdx, (t) => ({
                          ...t,
                          min: parseNullableNumber(e.target.value),
                        }))
                      }
                      className={`${inputClass} w-20 text-right tabular-nums`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`tier-max-${tier.id}`}
                      className={labelClass}
                    >
                      Max
                    </label>
                    <input
                      id={`tier-max-${tier.id}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={tier.max ?? ""}
                      placeholder="∞"
                      onChange={(e) =>
                        onTierChange(tierIdx, (t) => ({
                          ...t,
                          max: parseNullableNumber(e.target.value),
                        }))
                      }
                      className={`${inputClass} w-20 text-right tabular-nums`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`tier-match-${tier.id}`}
                      className={labelClass}
                    >
                      Match options (pisah koma)
                    </label>
                    <input
                      id={`tier-match-${tier.id}`}
                      type="text"
                      value={(tier.matchOptions ?? []).join(", ")}
                      placeholder="mis. ya, yes"
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parts = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0);
                        onTierChange(tierIdx, (t) => {
                          // String kosong -> hapus matchOptions (tier numeric murni).
                          if (parts.length === 0) {
                            const { matchOptions: _drop, ...rest } = t;
                            return { ...rest };
                          }
                          return { ...t, matchOptions: parts };
                        });
                      }}
                      className={`${inputClass} w-40`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`tier-mandays-${tier.id}`}
                      className={labelClass}
                    >
                      Mandays
                    </label>
                    <input
                      id={`tier-mandays-${tier.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={tier.mandays}
                      onChange={(e) => {
                        const parsed =
                          e.target.value.trim() === ""
                            ? 0
                            : Number(e.target.value);
                        onTierChange(tierIdx, (t) => ({
                          ...t,
                          mandays: Number.isNaN(parsed) ? t.mandays : parsed,
                        }));
                      }}
                      className={`${inputClass} w-24 text-right tabular-nums`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`tier-shift-${tier.id}`}
                      className={labelClass}
                    >
                      Level shift
                    </label>
                    <select
                      id={`tier-shift-${tier.id}`}
                      value={tier.levelShift ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onTierChange(tierIdx, (t) => {
                          // Kosong -> hapus levelShift (pertahankan level default).
                          if (value === "") {
                            const { levelShift: _drop, ...rest } = t;
                            return { ...rest };
                          }
                          return { ...t, levelShift: value as StaffLevel };
                        });
                      }}
                      className={`${inputClass} w-40`}
                    >
                      <option value="">(tidak menggeser)</option>
                      {ALL_STAFF_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {staffLevelLabel(level)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => onRemoveTier(tierIdx)}
                  >
                    Hapus tier
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfigEditor;
