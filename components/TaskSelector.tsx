"use client";

// TaskSelector — UI langkah pertama estimasi: pemilihan kategori & task (Req 1).
//
// Fungsi utama:
// - Menampilkan seluruh kategori dari konfigurasi aktif sebagai accordion (Req 1.1).
// - Saat kategori dibuka, menampilkan task-nya sebagai checklist (Req 1.2).
// - Task default TIDAK tercentang; pengguna memilih sendiri task yang dibutuhkan (Req 1.3).
// - Mencentang/menghapus centang task menyimpan/menghapus pilihan pada state sesi (Req 1.4, 1.5).
//   Task yang tidak dicentang otomatis dikecualikan dari perhitungan (Req 1.6) karena
//   Calculation Engine hanya membaca selectedTaskIds.
// - Aksi cepat "centang semua"/"kosongkan semua" per kategori (Req 1.7).
// - Pemilihan bisa lintas kategori dalam satu sesi (Req 1.8) — selectedTaskIds bersifat global.

import { useMemo, useState } from "react";

import { useConfig, useSession } from "../context/ConfigContext";

// ============================================================================
// Komponen utama
// ============================================================================

export function TaskSelector() {
  // Config menyediakan daftar kategori aktif (Req 1.1).
  const { config } = useConfig();
  // Session menyediakan pilihan task dan fungsi mutasinya (Req 1.4, 1.5, 1.7).
  const { selectedTaskIds, toggleTask, setTasksSelected } = useSession();

  // Kategori mana yang sedang terbuka (accordion). Menggunakan Set agar
  // beberapa kategori bisa terbuka bersamaan. Default: semua tertutup.
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  // Buka/tutup satu kategori.
  const toggleCategory = (categoryId: string) => {
    setOpenCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">Pilih Kategori &amp; Task</h2>
        <p className="mt-1 text-sm text-ink/70">
          Centang task yang relevan dengan project. Task yang tidak dicentang
          tidak ikut dihitung.
        </p>
      </header>

      {/* Daftar kategori sebagai accordion (Req 1.1) */}
      <div className="flex flex-col gap-3">
        {config.categories.map((category) => (
          <CategoryAccordion
            key={category.id}
            categoryId={category.id}
            categoryName={category.name}
            taskIds={category.tasks.map((task) => task.id)}
            tasks={category.tasks}
            open={openCategoryIds.has(category.id)}
            selectedTaskIds={selectedTaskIds}
            onToggleOpen={() => toggleCategory(category.id)}
            onToggleTask={toggleTask}
            onSetAll={(selected) =>
              setTasksSelected(
                category.tasks.map((task) => task.id),
                selected,
              )
            }
          />
        ))}

        {/* Kondisi kosong: tidak ada kategori di konfigurasi. */}
        {config.categories.length === 0 && (
          <p className="rounded-md border border-ink/10 bg-white/50 p-4 text-sm text-ink/60">
            Belum ada kategori pada konfigurasi aktif.
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Sub-komponen: satu kategori (accordion)
// ============================================================================

interface CategoryAccordionProps {
  categoryId: string;
  categoryName: string;
  // Daftar id task di kategori ini (untuk aksi centang/kosongkan semua).
  taskIds: string[];
  // Data task yang ditampilkan sebagai checklist.
  tasks: { id: string; name: string }[];
  open: boolean;
  selectedTaskIds: Set<string>;
  onToggleOpen: () => void;
  onToggleTask: (taskId: string) => void;
  onSetAll: (selected: boolean) => void;
}

function CategoryAccordion({
  categoryId,
  categoryName,
  taskIds,
  tasks,
  open,
  selectedTaskIds,
  onToggleOpen,
  onToggleTask,
  onSetAll,
}: CategoryAccordionProps) {
  // Hitung jumlah task terpilih dalam kategori ini (opsional, membantu ringkasan — MVP).
  const selectedCount = useMemo(
    () => taskIds.reduce((count, id) => (selectedTaskIds.has(id) ? count + 1 : count), 0),
    [taskIds, selectedTaskIds],
  );

  // Id unik untuk asosiasi ARIA antara tombol header dan panel isi.
  const panelId = `task-panel-${categoryId}`;
  const headerId = `task-header-${categoryId}`;

  return (
    <div className="overflow-hidden rounded-lg border border-ink/15 bg-white/60">
      {/* Header accordion: tombol yang bisa diakses keyboard dengan aria-expanded */}
      <h3 id={headerId} className="m-0">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
        >
          <span className="flex items-center gap-2">
            {/* Ikon panah (rotasi menandakan buka/tutup) */}
            <span
              aria-hidden="true"
              className={`inline-block text-ink/50 transition-transform ${
                open ? "rotate-90" : "rotate-0"
              }`}
            >
              ▶
            </span>
            <span className="font-semibold text-ink">{categoryName}</span>
          </span>

          {/* Ringkasan jumlah task terpilih / total */}
          <span className="shrink-0 text-sm text-ink/60">
            {selectedCount} / {tasks.length} terpilih
          </span>
        </button>
      </h3>

      {/* Panel isi: checklist task + aksi cepat. Dirender hanya saat terbuka. */}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-ink/10 px-4 py-3"
        >
          {/* Aksi cepat per kategori (Req 1.7) */}
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSetAll(true)}
              className="rounded-md border border-ink/20 px-3 py-1 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              Centang semua
            </button>
            <button
              type="button"
              onClick={() => onSetAll(false)}
              className="rounded-md border border-ink/20 px-3 py-1 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              Kosongkan semua
            </button>
          </div>

          {/* Checklist task (Req 1.2, 1.3) */}
          {tasks.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {tasks.map((task) => {
                const checkboxId = `task-checkbox-${task.id}`;
                const checked = selectedTaskIds.has(task.id);
                return (
                  <li key={task.id}>
                    <label
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-cream"
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleTask(task.id)}
                        className="h-4 w-4 shrink-0 accent-ink"
                      />
                      <span className="text-sm text-ink">{task.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink/60">Kategori ini belum memiliki task.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskSelector;
