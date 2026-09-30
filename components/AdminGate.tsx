"use client";

// AdminGate — gerbang UI (client-side) untuk mode Konfigurasi.
//
// PENTING: ini GATE praktis untuk pilot, BUKAN keamanan sungguhan. Data auth ada di
// localStorage dan siapa pun teknis bisa melihatnya via DevTools. Lihat lib/auth.ts.
//
// Menangani DUA kondisi:
// 1. First-run (isAdminConfigured === false): form "Buat Password Admin" (password +
//    konfirmasi). Submit -> createAdminPassword lalu langsung masuk sebagai admin.
// 2. Sudah dikonfigurasi tapi belum login: form "Login Admin" (satu input password).
//    Submit -> loginAdmin; bila gagal tampilkan "Password salah". Ada link
//    "Lupa password? Reset" yang memanggil resetAdminPassword setelah konfirmasi.
//
// Semua input password WAJIB type="password". Password/hash tidak pernah ditampilkan.

import { useState } from "react";

import { useAuth } from "../context/ConfigContext";

// Kelas styling konsisten dengan ConfigEditor (token cream/ink).
const inputClass =
  "rounded-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/20";
const labelClass = "text-xs font-medium text-ink/70";
const btnBase =
  "rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ink/20";
const btnPrimary = `${btnBase} bg-ink text-cream hover:bg-ink/90`;

export function AdminGate() {
  const { isAdminConfigured, envAuthMode } = useAuth();

  // MODE ENV: password admin dikelola global via env var Vercel. SELALU tampilkan
  // LoginForm (tidak pernah form buat-password), dan sembunyikan opsi reset.
  // MODE LOCAL: perilaku lama (first-run buat-password vs login + reset).
  if (envAuthMode) {
    return (
      <section className="mx-auto w-full max-w-md">
        <LoginForm envAuthMode />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md">
      {isAdminConfigured ? <LoginForm /> : <CreatePasswordForm />}
    </section>
  );
}

// ============================================================================
// First-run: buat password admin
// ============================================================================

function CreatePasswordForm() {
  const { createAdminPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 4) {
      setError("Password minimal 4 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setBusy(true);
    try {
      // Buat password lalu langsung masuk sebagai admin (di-handle context).
      await createAdminPassword(password);
    } catch {
      setError("Gagal membuat password di lingkungan ini.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-ink/20 bg-white/70 p-6"
    >
      <h2 className="text-xl font-bold text-ink">Buat Password Admin</h2>
      <p className="mt-1 text-sm text-ink/70">
        Belum ada password admin. Buat satu untuk membuka mode Konfigurasi. Ini
        gerbang sederhana untuk pilot, bukan keamanan penuh.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-new-password" className={labelClass}>
            Password baru
          </label>
          <input
            id="admin-new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-confirm-password" className={labelClass}>
            Konfirmasi password
          </label>
          <input
            id="admin-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <button type="submit" className={`${btnPrimary} mt-4 w-full`} disabled={busy}>
        {busy ? "Menyimpan…" : "Buat & Masuk sebagai Admin"}
      </button>
    </form>
  );
}

// ============================================================================
// Sudah dikonfigurasi: login admin
// ============================================================================

function LoginForm({ envAuthMode = false }: { envAuthMode?: boolean }) {
  const { loginAdmin, resetAdminPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const ok = await loginAdmin(password);
      if (!ok) {
        setError("Password salah.");
      }
      // Bila sukses, context menaikkan role -> AppShell merender Konfigurasi.
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    const confirmed = window.confirm(
      "Reset akses admin? Seluruh akses admin akan di-set ulang dan Anda perlu " +
        "membuat password baru. Konfigurasi TIDAK terhapus.",
    );
    if (confirmed) {
      resetAdminPassword();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-ink/20 bg-white/70 p-6"
    >
      <h2 className="text-xl font-bold text-ink">Login Admin</h2>
      <p className="mt-1 text-sm text-ink/70">
        Mode Konfigurasi hanya untuk admin. Masukkan password admin untuk melanjutkan.
      </p>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="admin-login-password" className={labelClass}>
          Password
        </label>
        <input
          id="admin-login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <button type="submit" className={`${btnPrimary} mt-4 w-full`} disabled={busy}>
        {busy ? "Memeriksa…" : "Masuk"}
      </button>

      {envAuthMode ? (
        // MODE ENV: password dikelola administrator lewat environment (Vercel).
        // Tidak ada opsi reset dari UI — ganti password dilakukan lewat env var + redeploy.
        <p className="mt-3 text-center text-xs text-ink/60">
          Password admin dikelola oleh administrator (environment).
        </p>
      ) : (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-ink/60 underline hover:text-ink"
          >
            Lupa password? Reset
          </button>
        </div>
      )}
    </form>
  );
}

export default AdminGate;
