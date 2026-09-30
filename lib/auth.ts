// Auth Layer aplikasi Mandays Generator.
//
// PENTING — batasan keamanan (baca ini):
// Aplikasi ini SEPENUHNYA client-side tanpa backend. "Login admin" di sini hanyalah
// GERBANG UI praktis untuk pilot, BUKAN keamanan sungguhan. Siapa pun yang teknis bisa
// membuka localStorage / DevTools dan melihat record auth atau melewati gate. Modul ini
// hanya mempersulit akses tidak sengaja, bukan mencegah penyerang. Jangan menganggap ini
// pengganti autentikasi backend.
//
// Tanggung jawab:
// - Simpan/baca record auth admin di localStorage pada key TERPISAH dari AppConfig
//   (mandays-generator:admin-auth) agar TIDAK ikut Export JSON konfigurasi.
// - Set / verifikasi / ganti / hapus password admin memakai Web Crypto (SHA-256 + salt).
//
// Password TIDAK PERNAH disimpan plaintext. Yang disimpan hanya salt acak + hash
// SHA-256(salt + password). Verifikasi menghitung ulang hash dengan salt tersimpan
// lalu membandingkan secara constant-time sederhana.
//
// Seluruh akses browser API (window/localStorage) di-guard (typeof window) agar aman
// dijalankan saat SSR / lingkungan Node dan tidak pernah throw. Web Crypto diakses via
// globalThis.crypto?.subtle; bila tidak tersedia, fungsi async menolak dengan aman.
//
// DUA MODE SUMBER PASSWORD:
// 1. MODE ENV — bila env var NEXT_PUBLIC_ADMIN_AUTH ada & valid (format "salt:hash",
//    keduanya hex non-kosong). Password menjadi GLOBAL & konsisten di semua browser
//    (incognito/device lain sama). Sumber kebenaran = env var, bukan localStorage.
//    Alur buat/ganti/reset TIDAK berlaku (dikelola via env var + redeploy di Vercel).
//    PENTING: karena app ini client-side, env var yang dibaca di client HARUS berprefix
//    NEXT_PUBLIC_ dan nilainya TER-EMBED di bundle. Karena itu env var berisi HASH
//    (bukan plaintext) agar password asli tidak muncul di bundle/repo. Ini tetap gate
//    UI, bukan keamanan kuat.
// 2. MODE LOCAL — bila env var tidak ada. Perilaku lama: localStorage per-browser,
//    first-run buat password, ganti, reset. Password tidak konsisten antar-browser.

// ============================================================================
// Konstanta
// ============================================================================

// Key localStorage TERPISAH untuk record auth admin. Sengaja tidak memakai key config
// (mandays-generator:config) agar tidak pernah ikut ter-export/import bersama AppConfig.
export const ADMIN_AUTH_KEY = "mandays-generator:admin-auth";

// Versi skema record auth, untuk migrasi di masa depan bila format berubah.
const AUTH_RECORD_VERSION = 1;

// Algoritma hash yang dipakai. Web Crypto mendukung "SHA-256".
const HASH_ALGO = "SHA-256";

// ============================================================================
// Tipe record auth
// ============================================================================

// Bentuk record auth yang disimpan sebagai JSON di localStorage.
// - salt: string acak (hex) yang digabung dengan password sebelum di-hash.
// - hash: hasil SHA-256(salt + password) dalam hex.
// - algo: nama algoritma hash (untuk transparansi & migrasi).
export interface AdminAuthRecord {
  version: number;
  salt: string;
  hash: string;
  algo: string;
}

// ============================================================================
// Helper encoding
// ============================================================================

// Ubah string menjadi ArrayBuffer memakai TextEncoder (UTF-8).
// Mengembalikan ArrayBuffer (bukan Uint8Array) agar kompatibel dengan tipe
// BufferSource yang diharapkan crypto.subtle.digest.
function stringToBuffer(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  // Salin ke ArrayBuffer baru berukuran pas untuk menghindari isu tipe
  // ArrayBufferLike (SharedArrayBuffer) pada beberapa target lib TS.
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

// Ubah ArrayBuffer / Uint8Array menjadi string hex.
function bytesToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

// ============================================================================
// Akses Web Crypto (di-guard)
// ============================================================================

// Mengembalikan SubtleCrypto bila tersedia, atau null bila tidak (lingkungan lama/tanpa crypto).
// Di Node 18+ dan browser modern, globalThis.crypto.subtle tersedia.
function getSubtle(): SubtleCrypto | null {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    return null;
  }
  return cryptoObj.subtle;
}

// Menghasilkan salt acak sebagai string hex. Panjang default 16 byte (128-bit).
// Di-guard: bila getRandomValues tidak tersedia, lempar error terkontrol.
function generateSaltHex(byteLength = 16): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error("Web Crypto getRandomValues tidak tersedia di lingkungan ini.");
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// Menghitung hash SHA-256 dari (salt + password) dan mengembalikan hex.
// Melempar error terkontrol bila SubtleCrypto tidak tersedia.
async function hashPassword(saltHex: string, password: string): Promise<string> {
  const subtle = getSubtle();
  if (!subtle) {
    throw new Error("Web Crypto subtle tidak tersedia di lingkungan ini.");
  }
  // Gabungkan salt + password lalu hash. Salt disimpan terpisah pada record.
  const data = stringToBuffer(saltHex + password);
  const digest = await subtle.digest(HASH_ALGO, data);
  return bytesToHex(digest);
}

// Perbandingan string constant-time sederhana untuk mengurangi kebocoran timing.
// Bukan jaminan kriptografis penuh, tetapi menghindari early-return pada mismatch.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ============================================================================
// Akses localStorage (di-guard)
// ============================================================================

// Mengecek apakah localStorage tersedia. False saat SSR / storage diblokir. Tidak throw.
function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Membaca & mem-parse record auth dari localStorage. Mengembalikan null bila:
// tidak ada, JSON rusak, storage tidak tersedia, atau bentuk record tidak valid.
function readAuthRecord(): AdminAuthRecord | null {
  if (!isStorageAvailable()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(ADMIN_AUTH_KEY);
    if (raw === null || raw.length === 0) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidAuthRecord(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Menyimpan record auth ke localStorage (JSON). No-op bila storage tidak tersedia.
function writeAuthRecord(record: AdminAuthRecord): void {
  if (!isStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(record));
  } catch {
    // Kegagalan tulis (mis. kuota penuh) tidak boleh mematahkan aplikasi.
  }
}

// Validasi bentuk record auth (guard runtime terhadap data localStorage yang tak tepercaya).
function isValidAuthRecord(value: unknown): value is AdminAuthRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.version === "number" &&
    typeof rec.salt === "string" &&
    rec.salt.length > 0 &&
    typeof rec.hash === "string" &&
    rec.hash.length > 0 &&
    typeof rec.algo === "string"
  );
}

// ============================================================================
// Mode ENV (env var Vercel NEXT_PUBLIC_ADMIN_AUTH)
// ============================================================================

// Nama env var yang menyimpan kredensial admin global (format "salt:hash").
// Prefix NEXT_PUBLIC_ WAJIB agar terbaca di client (nilainya di-inline ke bundle).
export const ADMIN_AUTH_ENV_KEY = "NEXT_PUBLIC_ADMIN_AUTH";

// Bentuk kredensial env yang sudah di-parse.
export interface EnvAuth {
  salt: string;
  hash: string;
}

// Regex hex non-kosong (huruf besar/kecil diizinkan).
const HEX_RE = /^[0-9a-fA-F]+$/;

// Fungsi murni: parse string mentah env var berformat "<saltHex>:<hashHex>".
// Return objek {salt, hash} bila valid (tepat satu ':' dan kedua sisi hex non-kosong),
// atau null bila undefined/kosong/format salah. Dibuat murni agar mudah dites tanpa
// bergantung pada process.env secara langsung.
export function parseEnvAuth(raw: string | undefined): EnvAuth | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Harus tepat berformat "salt:hash" (satu pemisah ':').
  const parts = trimmed.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const [salt, hash] = parts;
  if (salt.length === 0 || hash.length === 0) {
    return null;
  }
  if (!HEX_RE.test(salt) || !HEX_RE.test(hash)) {
    return null;
  }
  // Normalisasi ke lowercase agar konsisten dengan output hashPassword (selalu lowercase
  // hex) saat perbandingan constant-time, apa pun kapitalisasi yang diisi di env var.
  return { salt: salt.toLowerCase(), hash: hash.toLowerCase() };
}

// Membaca kredensial env dari process.env.NEXT_PUBLIC_ADMIN_AUTH lalu mem-parse-nya.
// Return null bila tidak ada/invalid. Karena NEXT_PUBLIC_ di-inline saat build, akses
// ini aman baik di server maupun client.
export function getEnvAuth(): EnvAuth | null {
  // Guard: process bisa tidak ada di sebagian lingkungan; jangan sampai throw.
  const env = typeof process !== "undefined" ? process.env : undefined;
  return parseEnvAuth(env?.[ADMIN_AUTH_ENV_KEY]);
}

// True bila aplikasi berjalan dalam MODE ENV (kredensial env valid tersedia).
export function isEnvAuthMode(): boolean {
  return getEnvAuth() !== null;
}

// ============================================================================
// API publik
// ============================================================================

// True bila password admin dianggap sudah dikonfigurasi.
// - MODE ENV: selalu true (dikonfigurasi lewat env var).
// - MODE LOCAL: true bila record auth ada & valid di localStorage.
// Dipakai UI untuk membedakan alur first-run (buat password) vs login.
export function isAdminConfigured(): boolean {
  if (isEnvAuthMode()) {
    return true;
  }
  return readAuthRecord() !== null;
}

// Set password admin baru: generate salt acak, hitung hash, simpan record.
// Dipakai untuk set awal (first-run) maupun mengganti password.
// Melempar error terkontrol bila Web Crypto tidak tersedia.
//
// MODE ENV: no-op aman (resolve tanpa menulis). Password dikelola lewat env var +
// redeploy, sehingga first-run "buat password" tidak berlaku. UI juga menyembunyikan
// alur ini, tetapi kita tetap jaga di sini agar tidak menimpa/menyentuh localStorage.
export async function setAdminPassword(newPassword: string): Promise<void> {
  if (isEnvAuthMode()) {
    return;
  }
  const saltHex = generateSaltHex();
  const hash = await hashPassword(saltHex, newPassword);
  const record: AdminAuthRecord = {
    version: AUTH_RECORD_VERSION,
    salt: saltHex,
    hash,
    algo: HASH_ALGO,
  };
  writeAuthRecord(record);
}

// Verifikasi password terhadap sumber kebenaran aktif.
// - MODE ENV: hitung SHA-256(saltEnv + password) lalu bandingkan constant-time dengan
//   hash dari env. Konsisten dengan skema hashPassword (salt + password, output hex).
// - MODE LOCAL: bandingkan dengan record di localStorage (perilaku lama).
// Mengembalikan false secara aman bila: belum ada record/env, storage/crypto tidak
// tersedia, atau password salah.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const envAuth = getEnvAuth();
  if (envAuth !== null) {
    try {
      const hash = await hashPassword(envAuth.salt, password);
      return constantTimeEqual(hash, envAuth.hash);
    } catch {
      // Web Crypto tidak tersedia -> gagal aman.
      return false;
    }
  }
  const record = readAuthRecord();
  if (record === null) {
    return false;
  }
  try {
    const hash = await hashPassword(record.salt, password);
    return constantTimeEqual(hash, record.hash);
  } catch {
    // Web Crypto tidak tersedia -> gagal aman.
    return false;
  }
}

// Ganti password admin: verifikasi password lama dulu. Bila cocok, set password baru
// dan return true. Bila tidak cocok, tidak mengubah apa pun dan return false.
//
// MODE ENV: return false (no-op). Password dikelola via env var + redeploy, tidak bisa
// diubah dari UI. UI juga menyembunyikan panel ganti password saat mode ENV.
export async function changeAdminPassword(
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  if (isEnvAuthMode()) {
    return false;
  }
  const ok = await verifyAdminPassword(oldPassword);
  if (!ok) {
    return false;
  }
  await setAdminPassword(newPassword);
  return true;
}

// Hapus record auth (reset darurat untuk kasus lupa password).
// Tanpa backend tidak ada mekanisme recovery lain. Config TIDAK tersentuh karena
// disimpan pada key berbeda. No-op bila storage tidak tersedia.
//
// MODE ENV: no-op. Reset tidak berlaku karena password dikelola via env var + redeploy;
// menghapus localStorage tidak berpengaruh pada sumber kebenaran (env).
export function clearAdminPassword(): void {
  if (isEnvAuthMode()) {
    return;
  }
  if (!isStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.removeItem(ADMIN_AUTH_KEY);
  } catch {
    // Abaikan kegagalan hapus.
  }
}
