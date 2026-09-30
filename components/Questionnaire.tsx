"use client";

// Questionnaire — UI langkah kedua estimasi: kuisioner berbasis kategori (Req 2).
//
// Fungsi utama:
// - Hanya merender pertanyaan yang RELEVAN, yaitu pertanyaan yang direferensikan oleh
//   role dari task terpilih melalui role.variable.questionId (Req 2.1, 2.4). Pertanyaan
//   yang tidak dirujuk task terpilih manapun disembunyikan.
// - Pertanyaan dikelompokkan per kategori (Question.categoryId); hanya kategori yang
//   memiliki minimal satu pertanyaan relevan yang ditampilkan.
// - Mendukung tipe pertanyaan single_choice (radio) dan numeric (input number) (Req 2.2).
// - Menyimpan jawaban via setAnswer(questionId, value); numeric disimpan sebagai number (Req 2.5).
//   Recompute mandays ditangani reaktif oleh komponen hasil yang membaca answers dari context.
// - Bila belum ada pertanyaan relevan, tampilkan pesan kosong yang informatif.

import { useMemo } from "react";

import { useConfig, useSession } from "../context/ConfigContext";
import type { Question } from "../lib/types";

// ============================================================================
// Komponen utama
// ============================================================================

export function Questionnaire() {
  // Config menyediakan daftar kategori (untuk nama & relasi task→questionId) dan pertanyaan.
  const { config } = useConfig();
  // Session menyediakan task terpilih, jawaban saat ini, dan fungsi setAnswer (Req 2.5).
  const { selectedTaskIds, answers, setAnswer } = useSession();

  // Kumpulkan questionId yang direferensikan oleh task terpilih (Req 2.1, 2.4).
  // Iterasi kategori → task → role; ambil variable.questionId dari setiap role terpilih
  // yang memiliki variable (satu task kini bisa punya beberapa role dengan variabel berbeda).
  const referencedQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const category of config.categories) {
      for (const task of category.tasks) {
        if (!selectedTaskIds.has(task.id)) continue;
        for (const role of task.roles) {
          if (role.variable) {
            ids.add(role.variable.questionId);
          }
        }
      }
    }
    return ids;
  }, [config.categories, selectedTaskIds]);

  // Peta id kategori → nama, agar judul grup mudah diambil tanpa loop berulang.
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of config.categories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [config.categories]);

  // Kelompokkan pertanyaan relevan per kategori, dengan menjaga urutan asal config.questions.
  // Hanya kategori yang memiliki minimal satu pertanyaan relevan yang masuk daftar.
  const groups = useMemo(() => {
    const byCategory = new Map<string, Question[]>();
    for (const question of config.questions) {
      // Lewati pertanyaan yang tidak dirujuk task terpilih (Req 2.4).
      if (!referencedQuestionIds.has(question.id)) {
        continue;
      }
      const list = byCategory.get(question.categoryId);
      if (list) {
        list.push(question);
      } else {
        byCategory.set(question.categoryId, [question]);
      }
    }

    // Bentuk hasil terurut mengikuti urutan kategori pada config.
    const result: { categoryId: string; categoryName: string; questions: Question[] }[] = [];
    for (const category of config.categories) {
      const questions = byCategory.get(category.id);
      if (questions && questions.length > 0) {
        result.push({
          categoryId: category.id,
          categoryName: categoryNameById.get(category.id) ?? category.id,
          questions,
        });
      }
    }
    return result;
  }, [config.questions, config.categories, categoryNameById, referencedQuestionIds]);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">Kuisioner</h2>
        <p className="mt-1 text-sm text-ink/70">
          Jawab pertanyaan berikut untuk menentukan kompleksitas task terpilih.
          Hasil dihitung ulang otomatis setiap jawaban berubah.
        </p>
      </header>

      {/* Kondisi kosong: belum ada task terpilih yang merujuk pertanyaan (Req 2.4). */}
      {groups.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-white/50 p-4 text-sm text-ink/60">
          Belum ada pertanyaan yang perlu dijawab. Pilih task yang membutuhkan
          parameter tambahan pada langkah sebelumnya untuk menampilkan kuisioner.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <QuestionGroup
              key={group.categoryId}
              categoryName={group.categoryName}
              questions={group.questions}
              answers={answers}
              onAnswer={setAnswer}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Sub-komponen: satu grup kategori
// ============================================================================

interface QuestionGroupProps {
  categoryName: string;
  questions: Question[];
  answers: Record<string, string | number>;
  onAnswer: (questionId: string, value: string | number) => void;
}

function QuestionGroup({ categoryName, questions, answers, onAnswer }: QuestionGroupProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink/15 bg-white/60">
      <h3 className="border-b border-ink/10 px-4 py-3 font-semibold text-ink">
        {categoryName}
      </h3>
      <div className="flex flex-col gap-5 px-4 py-4">
        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            answer={answers[question.id]}
            onAnswer={onAnswer}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-komponen: satu pertanyaan (single_choice atau numeric)
// ============================================================================

interface QuestionFieldProps {
  question: Question;
  // Jawaban saat ini; undefined bila belum dijawab (memakai tier default — Req 2.3).
  answer: string | number | undefined;
  onAnswer: (questionId: string, value: string | number) => void;
}

function QuestionField({ question, answer, onAnswer }: QuestionFieldProps) {
  // Id dasar untuk asosiasi label/aria yang unik per pertanyaan.
  const fieldId = `question-${question.id}`;
  const helpId = question.helpText ? `${fieldId}-help` : undefined;

  if (question.type === "single_choice") {
    // Radio group memakai fieldset/legend agar seluruh opsi terasosiasi ke pertanyaan.
    return (
      <fieldset aria-describedby={helpId}>
        <legend className="text-sm font-medium text-ink">{question.text}</legend>
        {question.helpText && (
          <p id={helpId} className="mt-0.5 text-xs text-ink/60">
            {question.helpText}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-1.5">
          {(question.options ?? []).map((option) => {
            const optionId = `${fieldId}-${option.value}`;
            const checked = answer === option.value;
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-cream"
              >
                <input
                  id={optionId}
                  type="radio"
                  name={fieldId}
                  value={option.value}
                  checked={checked}
                  onChange={() => onAnswer(question.id, option.value)}
                  className="h-4 w-4 shrink-0 accent-ink"
                />
                <span className="text-sm text-ink">{option.label}</span>
              </label>
            );
          })}
          {/* Kondisi konfigurasi tidak lengkap: single_choice tanpa opsi. */}
          {(question.options ?? []).length === 0 && (
            <p className="text-sm text-ink/60">
              Pertanyaan ini belum memiliki opsi jawaban.
            </p>
          )}
        </div>
      </fieldset>
    );
  }

  // Tipe numeric: input number tunggal. Jawaban disimpan sebagai number (Req 2.5).
  return (
    <div>
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {question.text}
      </label>
      {question.helpText && (
        <p id={helpId} className="mt-0.5 text-xs text-ink/60">
          {question.helpText}
        </p>
      )}
      <input
        id={fieldId}
        type="number"
        // Tampilkan nilai saat ini; kosong bila belum dijawab (undefined).
        value={answer === undefined ? "" : answer}
        aria-describedby={helpId}
        onChange={(event) => {
          const raw = event.target.value;
          // Input kosong dianggap belum dijawab → simpan string kosong agar
          // Calculation Engine memakai tier default (Req 2.3). Bila terisi, simpan sebagai number.
          if (raw === "") {
            onAnswer(question.id, "");
            return;
          }
          const parsed = Number(raw);
          onAnswer(question.id, Number.isNaN(parsed) ? "" : parsed);
        }}
        className="mt-2 w-40 rounded-md border border-ink/20 bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
      />
    </div>
  );
}

export default Questionnaire;
