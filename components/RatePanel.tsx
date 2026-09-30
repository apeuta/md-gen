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
  // Config menyediakan rate tersimpan + fungsi setRate untuk mengubahnya.
  const { config, setRate } = useConfig();
  // Session menyediakan task terpilih dan jawaban kuisioner (Req 1.3, 2.5).
  const { selectedTaskIds, answers } = useSession();

  // Hitung ulang hasil (termasuk totalPerLevel, costPerLevel, grandTotalCost)
  // secara reaktif setiap input berubah (Req 2.5, 6.2, 6.4).
  const result: EstimationResult = useMemo(
    () => calculate({ config, selectedTaskIds, answers }),
    [config, selectedTaskIds, answers],
  );

  // Apakah minimal satu rate telah diisi? Menentukan tampil/tidaknya grand total biaya (Req 6.4).
  const hasAnyRate = useMemo(
    () =>
      ALL_STAFF_LEVELS.some((level) => {
        const rate = config.rates[level];
        return rate !== undefined && rate > 0;
      }),
    [config.rates],
  );

  // Handler perubahan input rate satu level.
  // String kosong -> undefined (hapus rate, diperlakukan nol). Angka valid & non-negatif -> simpan (Req 6.3).
  function handleRateChange(level: StaffLevel, raw: string) {
    if (raw.trim() === "") {
      setRate(level, undefined);
      return;
    }
    const parsed = Number(raw);
    // Abaikan input yang bukan angka valid atau negatif; rate biaya harus non-negatif.
    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }
    setRate(level, parsed);
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-ink">Rate &amp; Estimasi Biaya</h2>
        <p className="mt-1 text-sm text-ink/70">
          Masukkan rate per level (opsional). Biaya dihitung sebagai total mandays
          level dikalikan rate. Level tanpa rate dianggap bernilai nol dan tidak
          menghambat perhitungan mandays.
        </p>
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
              const rateValue = config.rates[level];
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
                  <td className="px-4 py-2 text-right">
                    <input
                      id={inputId}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      // Nilai terkontrol: kosong bila rate belum diisi (Req 6.5).
                      value={rateValue ?? ""}
                      onChange={(e) => handleRateChange(level, e.target.value)}
                      placeholder="0"
                      aria-label={`Rate untuk ${staffLevelLabel(level)} per manday`}
                      className="w-32 rounded-md border border-ink/20 bg-white px-2 py-1 text-right tabular-nums text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/20"
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink">
                    {/* Biaya level = total mandays × rate; rate kosong -> 0 (Req 6.2, 6.3). */}
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

      {/* Catatan unit rate bebas: requirements tidak menetapkan mata uang spesifik. */}
      <p className="mt-3 text-xs text-ink/60">
        Catatan: unit rate bersifat bebas (mis. IDR, USD, atau satuan internal) dan
        mengikuti kesepakatan Anda. Angka ditampilkan dengan pemisah ribuan tanpa
        simbol mata uang.
      </p>
    </section>
  );
}

export default RatePanel;
