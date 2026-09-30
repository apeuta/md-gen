"use client";

// ChangePasswordPanel — form ganti password admin. Hanya dirender saat role === "admin".
//
// Memanggil changeAdminPassword(old, new): verifikasi old dulu, bila cocok set new.
// Semua input WAJIB type="password". Tidak pernah menampilkan password/hash.

import { useState } from "react";

import { useAuth } from "../context/ConfigContext";

const inputClass =
  "rounded-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/20";
const labelClass = "text-xs font-medium text-ink/70";
const btnBase =
  "rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ink/20";
const btnPrimary = `${btnBase} bg-ink text-cream hover:bg-ink/90`;

// Status feedback hasil ganti password.
type Feedback =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export function ChangePasswordPanel() {
  const { role, changeAdminPassword } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  // Panel ini hanya relevan untuk admin. Jangan tampilkan apa pun ke General User.
  if (role !== "admin") {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback({ status: "idle" });

    if (newPassword.length < 4) {
      setFeedback({ status: "error", message: "Password baru minimal 4 karakter." });
      return;
    }
    if (newPassword !== confirm) {
      setFeedback({ status: "error", message: "Konfirmasi password baru tidak cocok." });
      return;
    }

    setBusy(true);
    try {
      const ok = await changeAdminPassword(oldPassword, newPassword);
      if (ok) {
        setFeedback({ status: "success" });
        setOldPassword("");
        setNewPassword("");
        setConfirm("");
      } else {
        setFeedback({ status: "error", message: "Password lama salah." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-4xl">
      <div className="rounded-lg border border-ink/20 bg-white/70 p-4">
        <h3 className="text-lg font-bold text-ink">Ganti Password Admin</h3>
        <p className="mt-1 text-sm text-ink/70">
          Ubah password admin. Perlu memasukkan password lama untuk verifikasi.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="change-old-password" className={labelClass}>
              Password lama
            </label>
            <input
              id="change-old-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={`${inputClass} max-w-sm`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-new-password" className={labelClass}>
              Password baru
            </label>
            <input
              id="change-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${inputClass} max-w-sm`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-confirm-password" className={labelClass}>
              Konfirmasi password baru
            </label>
            <input
              id="change-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${inputClass} max-w-sm`}
            />
          </div>

          {feedback.status === "success" && (
            <p
              role="status"
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              Password admin berhasil diganti.
            </p>
          )}
          {feedback.status === "error" && (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {feedback.message}
            </p>
          )}

          <div>
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Menyimpan…" : "Ganti Password"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ChangePasswordPanel;
