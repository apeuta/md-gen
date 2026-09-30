// Model data dan tipe TypeScript untuk aplikasi Mandays Generator.
// Seluruh tipe di-export agar dapat dipakai modul lain (calc.ts, persistence.ts, komponen UI, dst).

// ============================================================================
// Level staff
// ============================================================================

// Level staff yang didukung sistem (Req 4.3).
export type StaffLevel =
  | "GENERAL_SA"
  | "SR_SA"
  | "GENERAL_ENGINEER"
  | "SME"
  | "SR_ENGINEER"
  | "GENERAL_PMO"
  | "SR_PMO";

// Label human-readable untuk setiap level staff.
// Dipakai UI agar tampilan enak dibaca (mis. "GENERAL_ENGINEER" -> "General Engineer").
export const STAFF_LEVEL_LABELS: Record<StaffLevel, string> = {
  GENERAL_SA: "General SA",
  SR_SA: "Sr. SA",
  GENERAL_ENGINEER: "General Engineer",
  SME: "SME",
  SR_ENGINEER: "Sr. Engineer",
  GENERAL_PMO: "General PMO",
  SR_PMO: "Sr. PMO",
};

// Helper mengembalikan label human-readable sebuah level.
// Fallback ke kode level itu sendiri bila tidak dikenal (pengaman tipe).
export function staffLevelLabel(level: StaffLevel): string {
  return STAFF_LEVEL_LABELS[level] ?? level;
}

// ============================================================================
// Struktur konfigurasi task & kategori
// ============================================================================

// Tier adalah salah satu opsi nilai pada sebuah variabel task.
export interface Tier {
  id: string;
  label: string;
  // Batas rentang untuk variabel numeric; `null` berarti tak terbatas.
  min: number | null;
  max: number | null;
  // Untuk variabel single_choice: cocok bila nilai jawaban termuat di matchOptions.
  matchOptions?: string[];
  // Nilai mandays bila tier ini terpilih (Req 3.3).
  mandays: number;
  // Bila diisi, geser level task ke level ini (Req 4.2).
  levelShift?: StaffLevel;
}

// Variabel yang membuat mandays sebuah task bergantung pada jawaban pertanyaan.
export interface TaskVariable {
  questionId: string;
  tiers: Tier[];
  // Tier yang dipakai bila jawaban tidak ada atau tidak cocok tier manapun.
  defaultTierId: string;
}

// TaskRole merepresentasikan SATU role yang terlibat dalam sebuah task.
// Satu task kini dapat melibatkan beberapa role sekaligus (mis. SA + PMO),
// masing-masing dengan baseline mandays dan variabel/tier sendiri.
export interface TaskRole {
  // Role (level staff) yang terlibat.
  level: StaffLevel;
  // Mandays dasar role ini bila tidak memiliki variabel.
  baselineMandays: number;
  // Opsional: variabel yang mengubah mandays/level role ini berdasarkan jawaban.
  variable?: TaskVariable;
}

// Task adalah unit pekerjaan yang dapat dipilih dan diestimasi.
// Sejak versi 2, satu task terdiri dari satu atau lebih role (minimal 1).
export interface Task {
  id: string;
  name: string;
  // Daftar role yang terlibat pada task ini (wajib minimal 1 role).
  roles: TaskRole[];
}

// Kategori mengelompokkan sekumpulan task.
export interface Category {
  id: string;
  name: string;
  tasks: Task[];
}

// ============================================================================
// Pertanyaan
// ============================================================================

// Jenis pertanyaan yang didukung.
export type QuestionType = "single_choice" | "numeric";

// Opsi jawaban untuk pertanyaan single_choice.
export interface QuestionOption {
  value: string;
  label: string;
}

// Pertanyaan yang jawabannya memengaruhi kalkulasi task variabel.
export interface Question {
  id: string;
  categoryId: string;
  text: string;
  type: QuestionType;
  // Wajib untuk type single_choice.
  options?: QuestionOption[];
  helpText?: string;
}

// ============================================================================
// Rate & konfigurasi aplikasi
// ============================================================================

// Tabel rate biaya per level (nilai per manday). Sebagian level boleh tidak diisi.
export type RateTable = Partial<Record<StaffLevel, number>>;

// Konfigurasi lengkap aplikasi yang dapat di-import/export.
export interface AppConfig {
  version: number;
  categories: Category[];
  questions: Question[];
  rates: RateTable;
}

// ============================================================================
// Input & output kalkulasi
// ============================================================================

// Input untuk Calculation Engine.
export interface EstimationInput {
  config: AppConfig;
  // Kumpulan id task yang dipilih pengguna (Req 1.3).
  selectedTaskIds: Set<string>;
  // Jawaban pengguna: questionId -> nilai (string untuk single_choice, number untuk numeric).
  answers: Record<string, string | number>;
}

// Hasil kalkulasi untuk satu role di dalam sebuah task.
export interface RoleResult {
  level: StaffLevel;
  mandays: number;
  // Tier yang terpilih bila role memiliki variabel.
  tierId?: string;
  // True bila jawaban ada tapi di luar rentang tier manapun (Req 3.5).
  outOfRange?: boolean;
}

// Hasil kalkulasi untuk satu task (menggabungkan seluruh role-nya).
export interface TaskResult {
  taskId: string;
  taskName: string;
  categoryId: string;
  // Rincian mandays per role pada task ini.
  roles: RoleResult[];
  // Jumlah mandays seluruh role pada task ini.
  totalMandays: number;
}

// Hasil kalkulasi keseluruhan.
export interface EstimationResult {
  perTask: TaskResult[];
  // categoryId -> (level -> total mandays).
  perCategoryPerLevel: Record<string, Record<StaffLevel, number>>;
  totalPerLevel: Record<StaffLevel, number>;
  grandTotalMandays: number;
  costPerLevel: Record<StaffLevel, number>;
  grandTotalCost: number;
}
