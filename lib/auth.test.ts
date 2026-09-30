// Unit test untuk lib/auth.ts (gate admin client-side).
// Lingkungan: node (crypto.subtle tersedia di Node 18+).
//
// Karena lib/auth.ts mengakses window.localStorage yang tidak ada di Node, kita
// sediakan shim in-memory pada globalThis SEBELUM memanggil fungsi. Shim ini hanya
// untuk test; perilaku produksi (guard typeof window) tidak diubah.
// Validates: Requirements gate admin (setAdminPassword, verifyAdminPassword,
// changeAdminPassword, isAdminConfigured, clearAdminPassword).

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  ADMIN_AUTH_KEY,
  ADMIN_AUTH_ENV_KEY,
  isAdminConfigured,
  setAdminPassword,
  verifyAdminPassword,
  changeAdminPassword,
  clearAdminPassword,
  parseEnvAuth,
} from "./auth";

// --- Shim localStorage in-memory ---
// Implementasi minimal yang cukup untuk auth.ts: getItem/setItem/removeItem.
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  } as Storage;
}

// Pasang window + localStorage in-memory sebelum tiap test agar auth.ts melihat storage.
beforeEach(() => {
  const storage = createMemoryStorage();
  // auth.ts memakai `window.localStorage`; sediakan objek window minimal.
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: storage,
  };
});

describe("lib/auth — gate admin client-side", () => {
  it("isAdminConfigured false sebelum set, true setelah set, false setelah clear", async () => {
    expect(isAdminConfigured()).toBe(false);

    await setAdminPassword("rahasia123");
    expect(isAdminConfigured()).toBe(true);

    clearAdminPassword();
    expect(isAdminConfigured()).toBe(false);
  });

  it("verifyAdminPassword true untuk password benar, false untuk password salah", async () => {
    await setAdminPassword("password-benar");

    expect(await verifyAdminPassword("password-benar")).toBe(true);
    expect(await verifyAdminPassword("password-salah")).toBe(false);
  });

  it("verifyAdminPassword false bila belum ada record", async () => {
    expect(await verifyAdminPassword("apa-saja")).toBe(false);
  });

  it("changeAdminPassword sukses dengan old benar, gagal dengan old salah", async () => {
    await setAdminPassword("lama123");

    // Old salah -> gagal & password tidak berubah.
    expect(await changeAdminPassword("salah", "baru123")).toBe(false);
    expect(await verifyAdminPassword("lama123")).toBe(true);

    // Old benar -> sukses & password berganti.
    expect(await changeAdminPassword("lama123", "baru123")).toBe(true);
    expect(await verifyAdminPassword("baru123")).toBe(true);
    expect(await verifyAdminPassword("lama123")).toBe(false);
  });

  it("record tersimpan BUKAN plaintext (hash != password) dan tidak memuat password", async () => {
    const password = "super-rahasia";
    await setAdminPassword(password);

    const raw = globalThis.window.localStorage.getItem(ADMIN_AUTH_KEY);
    expect(raw).not.toBeNull();

    const record = JSON.parse(raw as string);
    // Hash tidak boleh sama dengan plaintext.
    expect(record.hash).not.toBe(password);
    // Password plaintext tidak boleh muncul di mana pun dalam record.
    expect(raw as string).not.toContain(password);
    // Bentuk record sesuai skema.
    expect(record.version).toBe(1);
    expect(record.algo).toBe("SHA-256");
    expect(typeof record.salt).toBe("string");
    expect((record.salt as string).length).toBeGreaterThan(0);
  });

  it("salt berbeda menghasilkan hash berbeda untuk password sama (salt acak)", async () => {
    await setAdminPassword("sama");
    const first = JSON.parse(
      globalThis.window.localStorage.getItem(ADMIN_AUTH_KEY) as string,
    );

    await setAdminPassword("sama");
    const second = JSON.parse(
      globalThis.window.localStorage.getItem(ADMIN_AUTH_KEY) as string,
    );

    // Salt acak -> praktis tidak mungkin sama, sehingga hash pun berbeda.
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});

// ============================================================================
// MODE ENV (NEXT_PUBLIC_ADMIN_AUTH)
// ============================================================================

describe("lib/auth — parseEnvAuth (fungsi murni)", () => {
  it("format valid 'salt:hash' hex -> objek {salt, hash}", () => {
    expect(parseEnvAuth("abcd1234:ff00aa")).toEqual({
      salt: "abcd1234",
      hash: "ff00aa",
    });
  });

  it("normalisasi hex uppercase menjadi lowercase", () => {
    expect(parseEnvAuth("ABCD:FF00")).toEqual({ salt: "abcd", hash: "ff00" });
  });

  it("undefined / kosong / whitespace -> null", () => {
    expect(parseEnvAuth(undefined)).toBeNull();
    expect(parseEnvAuth("")).toBeNull();
    expect(parseEnvAuth("   ")).toBeNull();
  });

  it("tanpa titik dua atau titik dua lebih dari satu -> null", () => {
    expect(parseEnvAuth("abcd1234")).toBeNull();
    expect(parseEnvAuth("aa:bb:cc")).toBeNull();
  });

  it("salah satu sisi kosong -> null", () => {
    expect(parseEnvAuth(":ff00")).toBeNull();
    expect(parseEnvAuth("abcd:")).toBeNull();
    expect(parseEnvAuth(":")).toBeNull();
  });

  it("mengandung karakter non-hex -> null", () => {
    expect(parseEnvAuth("xyz:ff00")).toBeNull();
    expect(parseEnvAuth("abcd:gg")).toBeNull();
  });
});

describe("lib/auth — mode ENV (verifyAdminPassword & isAdminConfigured)", () => {
  // Bersihkan env var setelah tiap test agar tidak bocor ke test mode LOCAL lainnya.
  afterEach(() => {
    delete process.env[ADMIN_AUTH_ENV_KEY];
  });

  it("verifyAdminPassword true untuk password benar & false untuk salah; isAdminConfigured true", async () => {
    const password = "password-env";

    // Susun salt+hash memakai skema hashing yang sama: buat record lewat setAdminPassword
    // ke storage in-memory (mode LOCAL, env belum diset), lalu baca salt+hash-nya.
    await setAdminPassword(password);
    const record = JSON.parse(
      globalThis.window.localStorage.getItem(ADMIN_AUTH_KEY) as string,
    );

    // Set env var sehingga aplikasi masuk MODE ENV. Kosongkan storage agar terbukti
    // bahwa sumber kebenaran benar-benar dari env, bukan localStorage.
    process.env[ADMIN_AUTH_ENV_KEY] = `${record.salt}:${record.hash}`;
    globalThis.window.localStorage.removeItem(ADMIN_AUTH_KEY);

    // Mode ENV: selalu terkonfigurasi.
    expect(isAdminConfigured()).toBe(true);

    // Password benar cocok dengan hash env; password salah tidak.
    expect(await verifyAdminPassword(password)).toBe(true);
    expect(await verifyAdminPassword("password-salah")).toBe(false);
  });

  it("mode ENV: setAdminPassword no-op, changeAdminPassword false, clearAdminPassword no-op", async () => {
    const password = "env-immutable";
    await setAdminPassword(password);
    const record = JSON.parse(
      globalThis.window.localStorage.getItem(ADMIN_AUTH_KEY) as string,
    );
    process.env[ADMIN_AUTH_ENV_KEY] = `${record.salt}:${record.hash}`;
    globalThis.window.localStorage.removeItem(ADMIN_AUTH_KEY);

    // setAdminPassword tidak menulis apa pun ke storage di mode ENV.
    await setAdminPassword("password-baru");
    expect(globalThis.window.localStorage.getItem(ADMIN_AUTH_KEY)).toBeNull();

    // changeAdminPassword selalu false di mode ENV.
    expect(await changeAdminPassword(password, "password-baru")).toBe(false);

    // clearAdminPassword no-op: env tetap jadi sumber kebenaran, verifikasi tetap jalan.
    clearAdminPassword();
    expect(isAdminConfigured()).toBe(true);
    expect(await verifyAdminPassword(password)).toBe(true);
  });
});
