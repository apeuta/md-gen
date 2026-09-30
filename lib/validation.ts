// Validasi skema konfigurasi aplikasi (AppConfig).
// Dipakai saat import JSON dan saat menyimpan lewat editor konfigurasi.
// Kontrak API: validateConfig(config: unknown) -> { valid: boolean; errors: string[] }
// Validasi ringan berbasis pengecekan struktur (tanpa library eksternal, sesuai MVP).
// Validates: Requirements 8.5, 7.6

import type { StaffLevel } from "./types";

// ============================================================================
// Konstanta
// ============================================================================

// Versi skema yang dikenal aplikasi saat ini (Req 8.5).
// Selaras dengan `version` pada seedConfig.
export const SUPPORTED_CONFIG_VERSIONS: readonly number[] = [2];

// Daftar level staff yang valid (harus selaras dengan tipe StaffLevel di types.ts).
const VALID_STAFF_LEVELS: ReadonlySet<StaffLevel> = new Set<StaffLevel>([
  "GENERAL_SA",
  "SR_SA",
  "GENERAL_ENGINEER",
  "SME",
  "SR_ENGINEER",
  "GENERAL_PMO",
  "SR_PMO",
]);

// Hasil validasi.
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Utilitas kecil
// ============================================================================

// Mengecek apakah nilai adalah objek non-null dan bukan array.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Mengecek apakah nilai adalah angka valid (bukan NaN/Infinity).
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// ============================================================================
// Validasi tier numeric — deteksi tumpang tindih ambigu (Req 7.6)
// ============================================================================

// Memeriksa apakah dua rentang numeric [minA..maxA] dan [minB..maxB] tumpang tindih.
// Batas `null` diperlakukan sebagai tak terbatas (min null = -inf, max null = +inf).
function rangesOverlap(
  minA: number | null,
  maxA: number | null,
  minB: number | null,
  maxB: number | null,
): boolean {
  const lowA = minA ?? Number.NEGATIVE_INFINITY;
  const highA = maxA ?? Number.POSITIVE_INFINITY;
  const lowB = minB ?? Number.NEGATIVE_INFINITY;
  const highB = maxB ?? Number.POSITIVE_INFINITY;
  // Dua rentang inklusif tumpang tindih bila awal salah satu <= akhir yang lain di kedua arah.
  return lowA <= highB && lowB <= highA;
}

// ============================================================================
// Validasi role (dan variabel/tier di dalamnya)
// ============================================================================

// Memvalidasi satu role: level valid, baselineMandays non-negatif, dan
// variabel (bila ada) memenuhi seluruh aturan tier seperti sebelumnya (Req 7.6).
function validateRole(
  role: unknown,
  roleIdx: number,
  taskName: string,
  questionIds: Set<string>,
  errors: string[],
): void {
  if (!isPlainObject(role)) {
    errors.push(
      `Task '${taskName}' memiliki role indeks ${roleIdx} yang tidak valid: harus berupa objek.`,
    );
    return;
  }

  const roleLabel = `role indeks ${roleIdx}`;

  // level wajib berupa level staff yang dikenal.
  if (!VALID_STAFF_LEVELS.has(role.level as StaffLevel)) {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'level' tidak dikenal: ${String(
        role.level,
      )}.`,
    );
  }

  // baselineMandays wajib angka non-negatif (Req 7.6).
  if (!isFiniteNumber(role.baselineMandays)) {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'baselineMandays' yang bukan angka.`,
    );
  } else if (role.baselineMandays < 0) {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'baselineMandays' negatif (${role.baselineMandays}); nilai harus non-negatif.`,
    );
  }

  // variable opsional; bila ada, validasi seperti aturan lama.
  const variable = role.variable;
  if (variable === undefined) {
    return;
  }
  if (!isPlainObject(variable)) {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'variable' yang tidak valid.`,
    );
    return;
  }

  // Referensi questionId harus menunjuk Question yang ada (Req 7.6 / relasi model).
  if (typeof variable.questionId !== "string") {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'variable.questionId' yang bukan string.`,
    );
  } else if (!questionIds.has(variable.questionId)) {
    errors.push(
      `Task '${taskName}' ${roleLabel} merujuk questionId '${variable.questionId}' yang tidak ditemukan pada daftar pertanyaan.`,
    );
  }

  // Tiers wajib array non-kosong.
  if (!Array.isArray(variable.tiers) || variable.tiers.length === 0) {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'variable.tiers' yang kosong atau bukan array.`,
    );
    return;
  }

  const tiers = variable.tiers as unknown[];
  const tierIds = new Set<string>();
  // Kumpulan tier numeric valid untuk pengecekan tumpang tindih.
  const numericTiers: { id: string; min: number | null; max: number | null }[] = [];

  tiers.forEach((tier, tierIdx) => {
    if (!isPlainObject(tier)) {
      errors.push(
        `Task '${taskName}' ${roleLabel} memiliki tier indeks ${tierIdx} yang tidak valid.`,
      );
      return;
    }

    const tierId =
      typeof tier.id === "string" && tier.id.length > 0
        ? tier.id
        : `indeks ${tierIdx}`;

    if (typeof tier.id === "string" && tier.id.length > 0) {
      tierIds.add(tier.id);
    }

    // mandays tier wajib non-negatif (Req 7.6).
    if (!isFiniteNumber(tier.mandays)) {
      errors.push(
        `Task '${taskName}' ${roleLabel} tier '${tierId}' memiliki 'mandays' yang bukan angka.`,
      );
    } else if (tier.mandays < 0) {
      errors.push(
        `Task '${taskName}' ${roleLabel} tier '${tierId}' memiliki 'mandays' negatif (${tier.mandays}); nilai harus non-negatif.`,
      );
    }

    // levelShift bila diisi harus level yang dikenal.
    if (
      tier.levelShift !== undefined &&
      !VALID_STAFF_LEVELS.has(tier.levelShift as StaffLevel)
    ) {
      errors.push(
        `Task '${taskName}' ${roleLabel} tier '${tierId}' memiliki 'levelShift' tidak dikenal: ${String(
          tier.levelShift,
        )}.`,
      );
    }

    // Tier dianggap numeric HANYA bila tidak berbasis matchOptions (single_choice)
    // dan memiliki batas min/max berupa angka (bukan sekadar null). Tier
    // single_choice boleh menyetel min/max = null sebagai penanda "tak terbatas"
    // tanpa dianggap numeric; memasukkannya ke cek tumpang tindih akan keliru
    // menandai dua opsi single_choice sebagai beririsan. Hanya tier numeric
    // yang dicek tumpang tindih (Req 7.6).
    const minVal = tier.min;
    const maxVal = tier.max;
    const hasMatchOptions = Array.isArray(tier.matchOptions);
    const minIsNumber = isFiniteNumber(minVal);
    const maxIsNumber = isFiniteNumber(maxVal);
    const minOk = minVal === null || minIsNumber;
    const maxOk = maxVal === null || maxIsNumber;
    const isNumericTier =
      !hasMatchOptions && (minIsNumber || maxIsNumber) && minOk && maxOk;

    if (isNumericTier) {
      numericTiers.push({
        id: tierId,
        min: (minVal ?? null) as number | null,
        max: (maxVal ?? null) as number | null,
      });
    }
  });

  // defaultTierId harus menunjuk salah satu tier yang ada (Req 7.6).
  if (typeof variable.defaultTierId !== "string") {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki 'variable.defaultTierId' yang bukan string.`,
    );
  } else if (!tierIds.has(variable.defaultTierId)) {
    errors.push(
      `Task '${taskName}' ${roleLabel} memiliki defaultTierId '${variable.defaultTierId}' yang tidak menunjuk tier manapun.`,
    );
  }

  // Tier numeric tidak boleh tumpang tindih ambigu (Req 7.6).
  for (let i = 0; i < numericTiers.length; i++) {
    for (let j = i + 1; j < numericTiers.length; j++) {
      const a = numericTiers[i];
      const b = numericTiers[j];
      if (rangesOverlap(a.min, a.max, b.min, b.max)) {
        errors.push(
          `Task '${taskName}' ${roleLabel} memiliki tier yang tumpang tindih: '${a.id}' dan '${b.id}' memiliki rentang yang beririsan.`,
        );
      }
    }
  }
}

// ============================================================================
// Validasi utama
// ============================================================================

// Memvalidasi struktur dan aturan bisnis sebuah AppConfig.
// Mengembalikan daftar pesan error deskriptif (Bahasa Indonesia) untuk ditampilkan di UI.
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Input harus berupa objek (Req 8.5).
  if (!isPlainObject(config)) {
    errors.push("Konfigurasi tidak valid: input harus berupa objek.");
    return { valid: false, errors };
  }

  // 2. Version harus dikenal (Req 8.5).
  const version = config.version;
  if (!isFiniteNumber(version)) {
    errors.push("Field 'version' wajib berupa angka.");
  } else if (!SUPPORTED_CONFIG_VERSIONS.includes(version)) {
    errors.push(
      `Versi konfigurasi ${version} tidak dikenal. Versi yang didukung: ${SUPPORTED_CONFIG_VERSIONS.join(", ")}.`,
    );
  }

  // 3. categories dan questions harus bertipe array (Req 8.5).
  const categoriesRaw = config.categories;
  const questionsRaw = config.questions;

  const categoriesIsArray = Array.isArray(categoriesRaw);
  const questionsIsArray = Array.isArray(questionsRaw);

  if (!categoriesIsArray) {
    errors.push("Field 'categories' wajib berupa array.");
  }
  if (!questionsIsArray) {
    errors.push("Field 'questions' wajib berupa array.");
  }

  // Bila salah satu struktur inti bukan array, hentikan validasi lanjutan
  // karena pemeriksaan relasi memerlukan keduanya.
  if (!categoriesIsArray || !questionsIsArray) {
    return { valid: false, errors };
  }

  const categories = categoriesRaw as unknown[];
  const questions = questionsRaw as unknown[];

  // 4. Kumpulkan seluruh questionId yang tersedia untuk pemeriksaan referensi.
  const questionIds = new Set<string>();
  questions.forEach((q, idx) => {
    if (!isPlainObject(q)) {
      errors.push(`Pertanyaan indeks ${idx} tidak valid: harus berupa objek.`);
      return;
    }
    if (typeof q.id !== "string" || q.id.length === 0) {
      errors.push(`Pertanyaan indeks ${idx} tidak memiliki 'id' yang valid.`);
      return;
    }
    questionIds.add(q.id);
  });

  // 5. Validasi tiap kategori dan task di dalamnya.
  categories.forEach((cat, catIdx) => {
    if (!isPlainObject(cat)) {
      errors.push(`Kategori indeks ${catIdx} tidak valid: harus berupa objek.`);
      return;
    }

    const catName =
      typeof cat.name === "string" && cat.name.length > 0
        ? cat.name
        : `indeks ${catIdx}`;

    if (!Array.isArray(cat.tasks)) {
      errors.push(`Kategori '${catName}' memiliki 'tasks' yang bukan array.`);
      return;
    }

    (cat.tasks as unknown[]).forEach((task, taskIdx) => {
      if (!isPlainObject(task)) {
        errors.push(
          `Task indeks ${taskIdx} pada kategori '${catName}' tidak valid: harus berupa objek.`,
        );
        return;
      }

      const taskName =
        typeof task.name === "string" && task.name.length > 0
          ? task.name
          : `indeks ${taskIdx}`;

      // 5a. roles wajib array non-kosong (minimal 1 role per task).
      if (!Array.isArray(task.roles) || task.roles.length === 0) {
        errors.push(
          `Task '${taskName}' memiliki 'roles' yang kosong atau bukan array; setiap task wajib punya minimal 1 role.`,
        );
        return;
      }

      // 5b. Validasi tiap role di dalam task.
      (task.roles as unknown[]).forEach((role, roleIdx) => {
        validateRole(role, roleIdx, taskName, questionIds, errors);
      });
    });
  });

  // 6. Validasi ringan rates (opsional). Bila ada, tiap nilai wajib angka non-negatif.
  // rates boleh tidak ada atau kosong (Partial); level yang tidak diisi dianggap 0.
  const ratesRaw = config.rates;
  if (ratesRaw !== undefined) {
    if (!isPlainObject(ratesRaw)) {
      errors.push("Field 'rates' wajib berupa objek.");
    } else {
      for (const [level, value] of Object.entries(ratesRaw)) {
        // Nilai undefined dianggap "tidak diisi" dan diabaikan.
        if (value === undefined) {
          continue;
        }
        if (!isFiniteNumber(value)) {
          errors.push(`Rate untuk level '${level}' bukan angka yang valid.`);
        } else if (value < 0) {
          errors.push(
            `Rate untuk level '${level}' negatif (${value}); nilai harus non-negatif.`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
