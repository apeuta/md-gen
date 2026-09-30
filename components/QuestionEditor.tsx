"use client";

// QuestionEditor — sub-komponen editor kuisioner untuk mode Konfigurasi (Req 7.5).
//
// Fungsi utama:
// - CRUD pertanyaan (Question) pada DRAFT yang dikelola ConfigEditor.
// - Tambah pertanyaan baru (id auto dari slug teks), edit text, categoryId
//   (dropdown dari daftar kategori draft), type (single_choice | numeric), helpText.
// - Untuk type single_choice: CRUD options ({ value, label }).
// - Untuk type numeric: options tidak dipakai (disembunyikan).
//
// Catatan: komponen ini TIDAK menyimpan apa pun sendiri. Seluruh perubahan
// dikirim lewat prop callback yang memutasi draft di ConfigEditor, sehingga
// perubahan pertanyaan ikut divalidasi & disimpan lewat handleSave (Req 7.6).
// Karena editor task membaca daftar pertanyaan dari draft yang sama, pertanyaan
// baru otomatis muncul pada dropdown questionId di editor task.

import type { Category, Question, QuestionOption, QuestionType } from "../lib/types";

// ============================================================================
// Kelas utility styling — selaras dengan ConfigEditor (token cream/ink)
// ============================================================================

const inputClass =
  "rounded-md border border-ink/20 bg-white px-2 py-1 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/20";
const labelClass = "text-xs font-medium text-ink/70";
const btnBase =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ink/20";
const btnGhost = `${btnBase} border border-ink/20 text-ink hover:bg-ink/5`;
const btnDanger = `${btnBase} border border-red-300 text-red-700 hover:bg-red-50`;

// ============================================================================
// Props
// ============================================================================

export interface QuestionEditorProps {
  questions: Question[];
  // Kategori pada draft, dipakai untuk dropdown categoryId agar konsisten.
  categories: Category[];
  onAddQuestion: () => void;
  onRemoveQuestion: (questionIdx: number) => void;
  onQuestionChange: (
    questionIdx: number,
    updater: (question: Question) => Question,
  ) => void;
}

// ============================================================================
// Komponen utama
// ============================================================================

export function QuestionEditor({
  questions,
  categories,
  onAddQuestion,
  onRemoveQuestion,
  onQuestionChange,
}: QuestionEditorProps) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink">Kuisioner</h3>
          <p className="mt-1 text-sm text-ink/70">
            Kelola pertanyaan kuisioner. Pertanyaan yang ada di sini dapat
            dipetakan ke variabel/tier task melalui pilihan questionId pada
            editor task di atas.
          </p>
        </div>
        <button type="button" className={btnGhost} onClick={onAddQuestion}>
          + Pertanyaan
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {questions.length === 0 && (
          <p className="rounded-md border border-dashed border-ink/20 px-4 py-6 text-center text-sm text-ink/60">
            Belum ada pertanyaan. Tambahkan pertanyaan untuk dipetakan ke task.
          </p>
        )}

        {questions.map((question, qIdx) => (
          <QuestionRow
            key={question.id}
            question={question}
            categories={categories}
            onRemove={() => onRemoveQuestion(qIdx)}
            onChange={(updater) => onQuestionChange(qIdx, updater)}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Sub-komponen: baris satu pertanyaan (atribut + opsi bila single_choice)
// ============================================================================

interface QuestionRowProps {
  question: Question;
  categories: Category[];
  onRemove: () => void;
  onChange: (updater: (question: Question) => Question) => void;
}

function QuestionRow({
  question,
  categories,
  onRemove,
  onChange,
}: QuestionRowProps) {
  // Mengubah type pertanyaan; menyesuaikan field options agar konsisten:
  // - single_choice: pastikan options terdefinisi (minimal array kosong).
  // - numeric: hapus options.
  function handleTypeChange(nextType: QuestionType) {
    onChange((q) => {
      if (nextType === "numeric") {
        const { options: _drop, ...rest } = q;
        return { ...rest, type: "numeric" };
      }
      return { ...q, type: "single_choice", options: q.options ?? [] };
    });
  }

  // --- Aksi opsi (khusus single_choice) ---

  function addOption() {
    onChange((q) => {
      const options = q.options ?? [];
      const nextOption: QuestionOption = { value: "", label: "" };
      return { ...q, options: [...options, nextOption] };
    });
  }

  function removeOption(optIdx: number) {
    onChange((q) => {
      const options = (q.options ?? []).filter((_, i) => i !== optIdx);
      return { ...q, options };
    });
  }

  function updateOption(
    optIdx: number,
    updater: (opt: QuestionOption) => QuestionOption,
  ) {
    onChange((q) => {
      const options = (q.options ?? []).map((opt, i) =>
        i === optIdx ? updater(opt) : opt,
      );
      return { ...q, options };
    });
  }

  return (
    <div className="rounded-md border border-ink/10 bg-cream/40 p-3">
      {/* Atribut dasar pertanyaan */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`q-text-${question.id}`} className={labelClass}>
            Teks pertanyaan
          </label>
          <input
            id={`q-text-${question.id}`}
            type="text"
            value={question.text}
            onChange={(e) =>
              onChange((q) => ({ ...q, text: e.target.value }))
            }
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`q-category-${question.id}`} className={labelClass}>
            Kategori
          </label>
          <select
            id={`q-category-${question.id}`}
            value={question.categoryId}
            onChange={(e) =>
              onChange((q) => ({ ...q, categoryId: e.target.value }))
            }
            className={`${inputClass} w-56`}
          >
            {/* Opsi kosong bila belum ada kategori tersedia */}
            {categories.length === 0 && (
              <option value="">(belum ada kategori)</option>
            )}
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} [{cat.id}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`q-type-${question.id}`} className={labelClass}>
            Tipe
          </label>
          <select
            id={`q-type-${question.id}`}
            value={question.type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            className={`${inputClass} w-40`}
          >
            <option value="single_choice">Pilihan tunggal</option>
            <option value="numeric">Angka</option>
          </select>
        </div>

        <button type="button" className={btnDanger} onClick={onRemove}>
          Hapus pertanyaan
        </button>
      </div>

      {/* Teks bantuan (opsional) */}
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor={`q-help-${question.id}`} className={labelClass}>
          Teks bantuan (opsional)
        </label>
        <input
          id={`q-help-${question.id}`}
          type="text"
          value={question.helpText ?? ""}
          placeholder="mis. penjelasan singkat untuk membantu pengisian"
          onChange={(e) =>
            onChange((q) => {
              const value = e.target.value;
              // String kosong -> hapus helpText agar tetap ringkas.
              if (value.trim() === "") {
                const { helpText: _drop, ...rest } = q;
                return { ...rest };
              }
              return { ...q, helpText: value };
            })
          }
          className={`${inputClass} w-full`}
        />
      </div>

      {/* Opsi jawaban — hanya untuk single_choice */}
      {question.type === "single_choice" && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={labelClass}>Opsi jawaban</span>
            <button type="button" className={btnGhost} onClick={addOption}>
              + Opsi
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {(question.options ?? []).length === 0 && (
              <p className="text-sm text-ink/50">
                Belum ada opsi. Tambahkan minimal satu opsi untuk pilihan tunggal.
              </p>
            )}

            {(question.options ?? []).map((opt, optIdx) => (
              <div
                key={optIdx}
                className="flex flex-wrap items-end gap-2 rounded-md border border-ink/10 bg-white/60 p-2"
              >
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`q-opt-value-${question.id}-${optIdx}`}
                    className={labelClass}
                  >
                    Value
                  </label>
                  <input
                    id={`q-opt-value-${question.id}-${optIdx}`}
                    type="text"
                    value={opt.value}
                    placeholder="mis. ya"
                    onChange={(e) =>
                      updateOption(optIdx, (o) => ({
                        ...o,
                        value: e.target.value,
                      }))
                    }
                    className={`${inputClass} w-40`}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor={`q-opt-label-${question.id}-${optIdx}`}
                    className={labelClass}
                  >
                    Label
                  </label>
                  <input
                    id={`q-opt-label-${question.id}-${optIdx}`}
                    type="text"
                    value={opt.label}
                    placeholder="mis. Ya, perlu konsultasi"
                    onChange={(e) =>
                      updateOption(optIdx, (o) => ({
                        ...o,
                        label: e.target.value,
                      }))
                    }
                    className={`${inputClass} w-full`}
                  />
                </div>

                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => removeOption(optIdx)}
                >
                  Hapus opsi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionEditor;
