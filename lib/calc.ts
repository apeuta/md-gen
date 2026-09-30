// Calculation Engine untuk Mandays Generator.
// Seluruh fungsi di sini adalah fungsi murni (pure) tanpa efek samping,
// agar mudah diuji dan reaktif terhadap perubahan input (Req 2.5).

import type {
  EstimationInput,
  EstimationResult,
  Question,
  QuestionType,
  StaffLevel,
  Task,
  TaskResult,
  Tier,
  TaskVariable,
} from "./types";

// ============================================================================
// Konstanta
// ============================================================================

// Daftar seluruh level staff yang didukung (Req 4.3).
// Dipakai untuk menginisialisasi agregasi agar SEMUA level selalu hadir dengan nilai 0.
export const ALL_STAFF_LEVELS: StaffLevel[] = [
  "GENERAL_SA",
  "SR_SA",
  "GENERAL_ENGINEER",
  "SME",
  "SR_ENGINEER",
  "GENERAL_PMO",
  "SR_PMO",
];

// ============================================================================
// Helper murni
// ============================================================================

// Membuat objek record baru dengan seluruh level bernilai 0.
function emptyLevelRecord(): Record<StaffLevel, number> {
  const record = {} as Record<StaffLevel, number>;
  for (const level of ALL_STAFF_LEVELS) {
    record[level] = 0;
  }
  return record;
}

// Mencari tier yang cocok dengan sebuah jawaban.
// Mengembalikan tier yang cocok, atau undefined bila tidak ada tier yang memenuhi.
// - numeric: tier PERTAMA yang memenuhi min <= nilai <= max (batas null = tak terbatas).
// - single_choice: tier yang matchOptions memuat nilai jawaban.
export function selectTier(
  variable: TaskVariable,
  answer: string | number,
  type: QuestionType
): Tier | undefined {
  if (type === "numeric") {
    const value = typeof answer === "number" ? answer : Number(answer);
    // Jawaban bukan angka valid dianggap tidak cocok tier manapun.
    if (Number.isNaN(value)) {
      return undefined;
    }
    return variable.tiers.find((tier) => {
      const lowerOk = tier.min === null || value >= tier.min;
      const upperOk = tier.max === null || value <= tier.max;
      return lowerOk && upperOk;
    });
  }

  // single_choice: cocokkan nilai terhadap matchOptions.
  const value = String(answer);
  return variable.tiers.find((tier) => tier.matchOptions?.includes(value));
}

// Mencari tier default berdasarkan defaultTierId.
function findDefaultTier(variable: TaskVariable): Tier | undefined {
  return variable.tiers.find((tier) => tier.id === variable.defaultTierId);
}

// Menyelesaikan hasil kalkulasi untuk satu task.
// Mengimplementasikan algoritma per-task dari design.md:
// 1. Tanpa variable -> baselineMandays + defaultLevel.
// 2. Dengan variable -> pilih tier dari jawaban, fallback ke defaultTierId,
//    set outOfRange hanya bila jawaban ADA tapi di luar seluruh rentang tier.
export function resolveTaskResult(
  task: Task,
  categoryId: string,
  answers: Record<string, string | number>,
  questions: Question[]
): TaskResult {
  // Kasus tanpa variabel: pakai baseline dan level default (Req 3.4, 4.5).
  if (!task.variable) {
    return {
      taskId: task.id,
      taskName: task.name,
      categoryId,
      mandays: task.baselineMandays,
      level: task.defaultLevel,
    };
  }

  const variable = task.variable;
  const answer = answers[variable.questionId];
  const hasAnswer = answer !== undefined && answer !== null && answer !== "";

  // Tentukan tipe pertanyaan; default ke numeric bila pertanyaan tidak ditemukan.
  const question = questions.find((q) => q.id === variable.questionId);
  const type: QuestionType = question?.type ?? "numeric";

  let matchedTier: Tier | undefined;
  if (hasAnswer) {
    matchedTier = selectTier(variable, answer, type);
  }

  let outOfRange = false;
  let tier = matchedTier;

  if (!tier) {
    // Tidak ada tier cocok -> gunakan tier default (Req 2.3, 3.5).
    tier = findDefaultTier(variable);
    // outOfRange hanya bila jawaban ADA tapi tidak cocok tier manapun.
    if (hasAnswer) {
      outOfRange = true;
    }
  }

  // Bila defaultTierId pun tidak valid, fallback aman ke baseline task.
  if (!tier) {
    return {
      taskId: task.id,
      taskName: task.name,
      categoryId,
      mandays: task.baselineMandays,
      level: task.defaultLevel,
      outOfRange: hasAnswer ? true : undefined,
    };
  }

  return {
    taskId: task.id,
    taskName: task.name,
    categoryId,
    mandays: tier.mandays,
    // Geser level bila tier punya levelShift, jika tidak pakai level default (Req 4.2, 4.5).
    level: tier.levelShift ?? task.defaultLevel,
    tierId: tier.id,
    outOfRange: outOfRange ? true : undefined,
  };
}

// ============================================================================
// Fungsi utama
// ============================================================================

// Menghitung estimasi lengkap dari input (config + task terpilih + jawaban).
// Fungsi murni: tidak mengubah input dan tidak punya efek samping.
export function calculate(input: EstimationInput): EstimationResult {
  const { config, selectedTaskIds, answers } = input;

  const perTask: TaskResult[] = [];
  const perCategoryPerLevel: Record<string, Record<StaffLevel, number>> = {};
  const totalPerLevel = emptyLevelRecord();

  // Iterasi seluruh kategori & task, proses hanya yang terpilih.
  for (const category of config.categories) {
    for (const task of category.tasks) {
      if (!selectedTaskIds.has(task.id)) {
        continue;
      }

      const result = resolveTaskResult(task, category.id, answers, config.questions);
      perTask.push(result);

      // Inisialisasi baseline level untuk kategori bila belum ada.
      if (!perCategoryPerLevel[category.id]) {
        perCategoryPerLevel[category.id] = emptyLevelRecord();
      }

      // Akumulasi per (kategori, level) dan per level global.
      perCategoryPerLevel[category.id][result.level] += result.mandays;
      totalPerLevel[result.level] += result.mandays;
    }
  }

  // Grand total mandays = jumlah seluruh mandays task.
  const grandTotalMandays = perTask.reduce((sum, t) => sum + t.mandays, 0);

  // Biaya per level = total mandays level * rate level (rate kosong = 0).
  const costPerLevel = emptyLevelRecord();
  for (const level of ALL_STAFF_LEVELS) {
    const rate = config.rates[level] ?? 0;
    costPerLevel[level] = totalPerLevel[level] * rate;
  }

  // Grand total biaya = jumlah seluruh biaya per level.
  const grandTotalCost = ALL_STAFF_LEVELS.reduce(
    (sum, level) => sum + costPerLevel[level],
    0
  );

  return {
    perTask,
    perCategoryPerLevel,
    totalPerLevel,
    grandTotalMandays,
    costPerLevel,
    grandTotalCost,
  };
}
