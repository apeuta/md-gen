// Generator nilai env var NEXT_PUBLIC_ADMIN_AUTH untuk MODE ENV (password admin global).
//
// Menghasilkan pasangan "<saltHex>:<hashHex>" di mana:
//   hashHex = SHA-256(saltHex + password) dalam hex (UTF-8 bytes dari string saltHex+password).
// Skema ini SAMA PERSIS dengan lib/auth.ts hashPassword(saltHex, password), sehingga
// verifyAdminPassword di aplikasi akan cocok.
//
// PENTING: skrip ini TIDAK mencetak / menyimpan password. Hanya salt + hash yang keluar.
// Karena app client-side, nilai env var ini akan TER-EMBED di bundle — itulah kenapa yang
// disimpan hash (bukan plaintext). Ini tetap gate UI, bukan keamanan kuat.
//
// Cara pakai:
//   node scripts/gen-admin-hash.mjs '<password>'
//
// Tanpa dependency eksternal — hanya modul bawaan Node (node:crypto).

import { randomBytes, createHash } from "node:crypto";

// Ambil password dari argumen CLI (argv[2]).
const password = process.argv[2];

// Bila password kosong/tidak diberikan, cetak cara pakai lalu keluar dengan kode error.
if (typeof password !== "string" || password.length === 0) {
  console.error("Cara pakai: node scripts/gen-admin-hash.mjs '<password>'");
  console.error("Contoh    : node scripts/gen-admin-hash.mjs 'rahasia-admin-2024'");
  process.exit(1);
}

// 1) Generate salt acak 16 byte -> hex (lowercase). Konsisten dengan generateSaltHex()
//    di lib/auth.ts yang juga memakai 16 byte dan output hex lowercase.
const saltHex = randomBytes(16).toString("hex");

// 2) Hitung hash = SHA-256(saltHex + password), output hex (lowercase).
//    createHash().update(string, "utf8") memproses UTF-8 bytes, identik dengan
//    TextEncoder().encode(saltHex + password) di lib/auth.ts.
const hashHex = createHash("sha256")
  .update(saltHex + password, "utf8")
  .digest("hex");

// 3) Nilai env siap pakai.
const value = `${saltHex}:${hashHex}`;

// Cetak instruksi + nilai. JANGAN mencetak password.
console.log("");
console.log("Nilai environment variable (siap pakai di Vercel):");
console.log("");
console.log(`NEXT_PUBLIC_ADMIN_AUTH=${value}`);
console.log("");
console.log("Hanya value (untuk field Value di dashboard Vercel):");
console.log("");
console.log(value);
console.log("");
console.log("Langkah di Vercel:");
console.log("  1. Buka Project Settings -> Environment Variables.");
console.log("  2. Tambahkan variabel: Name = NEXT_PUBLIC_ADMIN_AUTH, Value = nilai di atas.");
console.log("  3. Pilih environment (Production/Preview/Development) sesuai kebutuhan.");
console.log("  4. Simpan lalu REDEPLOY agar nilai baru ter-embed ke bundle.");
console.log("");
console.log("Untuk mengganti password: jalankan ulang skrip ini dengan password baru,");
console.log("perbarui nilai NEXT_PUBLIC_ADMIN_AUTH, lalu redeploy.");
console.log("");
