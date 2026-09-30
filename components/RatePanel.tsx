"use client";

// RatePanel — UI langkah ketiga estimasi (bagian rate & biaya): input rate per level
// dan tampilan estimasi biaya (Req 6).
//
// Fungsi utama:
// - Menyediakan input rate (angka) per level staff. Rate bersifat OPSIONAL — pengguna
//   boleh mengisi sebagian atau tidak sama sekali (Req 6.1, 6.5).
// - Rate dibaca dari config.rates (persisted) dan diubah via setRate() dari ConfigContext.
//   Input kosong menghapus rate level tersebut sehingga diperlakukan sebagai nol (Req 6.3).
// - Menghitung EstimationResult secara REAKTIF dengan useMemo yang memanggil calculate()
//   setiap kali config, selectedTaskIds, atau answers berubah (Req 2.5).
// - Menampilkan biaya per level (total mandays level × rate) dan grand total biaya (Req 6.2, 6.4).
// - Grand total biaya hanya ditampilkan bila minimal satu rate diisi (Req 6.4).
// - Aman saat tidak ada task terpilih / seluruh nilai nol (Req 5.5, 6.3).
//
// Catatan mata uang: requirements menyebut "rate (mata uang)" namun tidak menetapkan
// mata uang spesifik. Karena itu nilai ditampilkan sebagai angka dengan pemisah ribuan
// dan diberi catatan bahwa unit rate bebas (mengikuti kesepakatan pengguna).

import { useMemo } from "react";

import { useConfig, useSession } from "../context/ConfigContext";
import { ALL_STAFF_LEVELS, calculate } from "../lib/calc";
import { staffLevelLabel } from "../lib/types";
import type { EstimationResult, StaffLevel } from "../lib/types";

// ============================================================================
// Helper format
// ============================================================================

// Formatter angka dengan pemisah ribuan (locale Indonesia) agar biaya enak dibaca.
// Maksimal 2 angka desimal supaya nilai pecahan (mis. hasil mandays 0.5 × rate) tetap terbaca.
const NUMBER_FORMAT = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

// Format nilai biaya/angka menjadi string berpemisah ribuan.
function formatAmount(value: number): string {
  // Bulatkan ringan untuk menghindari galat floating point sebelum diformat.
  const rounded = Math.round(value * 100) / 100;
  return NUMBER_FORMAT.format(rounded);
}

// ============================================================================
// Komponen utama
// ============================================================================

export function RatePanel() {
  // Config menyediakan rate DEFAULT (persisted) yang diatur di tab Konfigurasi.
  const { config } = useConfig();
  // Session menyediakan task terpilih, jawaban, dan OVERRIDE rate sesi (ephemeral).
  const {
    selectedTaskIds,
    answers,
    rateOverrides,
    setRateOverride,
    clearRateOverrides,
  } = useSession();

  // Hitung ulang hasil (termasuk totalPerLevel, costPerLevel, grandTotalCost)
  // secara reaktif setiap input berubah (Req 2.5, 6.2, 6.4).
  // rateOverrides sesi diteruskan agar biaya memakai rate efektif.
  const result: EstimationResult = useMemo(
    () => calculate({ config, selectedTaskIds, answers, rateOverrides }),
    [config, selectedTaskIds, answers, rateOverrides],
  );

  // Rate efektif per level: override sesi bila ada, selain itu default config, selain itu 0.
  function effectiveRate(level: StaffLevel): number {
    return rateOverrides[level] ?? config.rates[level] ?? 0;
  }

  // Apakah minimal satu rate EFEKTIF terisi? Menentukan tampil/tidaknya grand total biaya (Req 6.4).
  const hasAnyRate = useMemo(
    () => ALL_STAFF_LEVELS.some((level) => effectiveRate(level) > 0),
    // effectiveRate bergantung pada config.rates & rateOverrides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.rates, rateOverrides],
  );

  // Apakah ada override sesi aktif? Menentukan aktif/tidaknya tombol reset.
  const hasOverrides = useMemo(
    () => ALL_STAFF_LEVELS.some((level) => rateOverrides[level] !== undefined),
    [rateOverrides],
  );

  // Handler perubahan input rate satu level -> mengedit OVERRIDE sesi (bukan default).
  // String kosong -> hapus override (kembali ke default). Angka valid & non-negatif -> simpan.
  function handleRateChange(level: StaffLevel, raw: string) {
    if (raw.trim() === "") {
      setRateOverride(level, undefined);
      return;
    }
    const parsed = Number(raw);
    // Abaikan input yang bukan angka valid atau negatif; rate biaya harus non-negatif.
    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }
    setRateOverride(level, parsed);
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Rate &amp; Estimasi Biaya</h2>
          <p className="mt-1 text-sm text-ink/70">
            Rate awal berasal dari default konfigurasi. Perubahan di sini bersifat
            sementara untuk estimasi ini saja dan TIDAK mengubah rate default.
            Biaya dihitung sebagai total mandays level dikalikan rate efektif.
          </p>
        </div>
        {/* Reset seluruh override sesi kembali ke rate default konfigurasi. */}
        <button
          type="button"
          onClick={clearRateOverrides}
          disabled={!hasOverrides}
          aria-disabled={!hasOverrides}
          title={
            hasOverrides
              ? "Kembalikan seluruh rate ke nilai default konfigurasi."
              : "Belum ada perubahan rate sementara untuk direset."
          }
          className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset ke rate default
        </button>
      </header>

      <div className="overflow-hidden rounded-lg border border-ink/20 bg-white/70">
        <table className="w-full border-collapse text-sm">
          <caption className="border-b border-ink/10 px-4 py-3 text-left font-semibold text-ink">
            Rate per Level
          </caption>
          <thead>
            <tr className="bg-cream text-left text-ink">
              <th scope="col" className="px-4 py-2 font-medium">
                Level
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Total Mandays
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Rate (per manday)
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Biaya
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Baris input rate untuk SETIAP level staff (Req 6.1). */}
            {ALL_STAFF_LEVELS.map((level) => {
              const totalMandays = result.totalPerLevel[level];
              const defaultRate = config.rates[level];
              const overrideRate = rateOverrides[level];
              // Nilai input = rate efektif (override bila ada, selain itu default).
              const effective = overrideRate ?? defaultRate;
              const isOverridden = overrideRate !== undefined;
              const cost = result.costPerLevel[level];
              // Id input untuk mengaitkan label secara aksesibel.
              const inputId = `rate-input-${level}`;

              return (
                <tr key={level} className="border-t border-ink/10">
                  <th
                    scope="row"
                    className="px-4 py-2 text-left font-normal text-ink"
                  >
                    {/* Label ter-asosiasi dengan input rate untuk aksesibilitas. */}
                    <label htmlFor={inputId}>{staffLevelLabel(level)}</label>
                  </th>
                  <td className="px-4 py-2 text-right tabular-nums text-ink/80">
                    {formatAmount(totalMandays)}
                  </td>
                  <td className="px-4 py-2 text-right align-top">
                    <input
                      id={inputId}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      // Nilai terkontrol: rate efektif; kosong bila belum ada default/override.
                      value={effective ?? ""}
                      onChange={(e) => handleRateChange(level, e.target.value)}
                      placeholder="0"
                      aria-label={`Rate untuk ${staffLevelLabel(level)} per manday`}
                      className={`w-32 rounded-md border bg-white px-2 py-1 text-right tabular-nums text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/20 ${
                        isOverridden ? "border-amber-400" : "border-ink/20"
                      }`}
                    />
                    {/* Penanda visual: bila nilai berasal dari override sesi, tampilkan
                        rate default sebagai pembanding; bila memakai default, beri tahu. */}
                    <div className="mt-1 text-[11px] leading-tight text-ink/50">
                      {isOverridden ? (
                        <span className="text-amber-700">
                          sementara · default: {defaultRate !== undefined ? formatAmount(defaultRate) : "—"}
                        </span>
                      ) : (
                        <span>default</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink align-top">
                    {/* Biaya level = total mandays × rate efektif (Req 6.2, 6.3). */}
                    {formatAmount(cost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {/* Grand total biaya keseluruhan; ditampilkan bila minimal satu rate diisi (Req 6.4). */}
            <tr className="border-t-2 border-ink/20 bg-cream/60 text-base font-bold text-ink">
              <th scope="row" colSpan={3} className="px-4 py-2 text-left">
                Grand total biaya
              </th>
              <td className="px-4 py-2 text-right tabular-nums">
                {hasAnyRate ? (
                  formatAmount(result.grandTotalCost)
                ) : (
                  // Belum ada rate diisi: biaya belum relevan, tampilkan penanda netral (Req 6.5).
                  <span className="font-normal text-ink/50">—</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Catatan: rate dua lapis + unit bebas. */}
      <p className="mt-3 text-xs text-ink/60">
        Rate awal diambil dari default konfigurasi (tab Konfigurasi &rarr; Rate).
        Perubahan di sini bersifat sementara (override sesi) dan tidak mengubah
        default; gunakan &ldquo;Reset ke rate default&rdquo; untuk membatalkannya.
        Unit rate bebas (mis. IDR, USD, atau satuan internal), ditampilkan dengan
        pemisah ribuan tanpa simbol mata uang.
      </p>
    </section>
  );
}

export default RatePanel;
