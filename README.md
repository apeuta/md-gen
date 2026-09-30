# Mandays Generator

Aplikasi web untuk membantu **Solution Architect (SA)** menyusun estimasi mandays sebuah project. SA memilih kategori & task yang relevan, menjawab kuisioner, lalu aplikasi menghitung mandays per task, per kategori, dan total — sekaligus mengalokasikannya ke level staff (mis. General Engineer vs Sr. Engineer) dan menghitung estimasi biaya opsional berbasis rate.

Aplikasi ini adalah MVP untuk pilot: berjalan **sepenuhnya di browser (client-side)**, tanpa backend maupun database. Konfigurasi disimpan di `localStorage` browser dan bisa di-import/export sebagai JSON. Deploy ke Vercel tanpa environment variable.

## Fitur Inti

**Mode Estimasi** (alur 3 langkah: Pilih → Kuisioner → Hasil)
- Pilih kategori & task lintas kategori (default tidak tercentang), dengan aksi cepat "centang semua" / "kosongkan semua" per kategori.
- Isi kuisioner per kategori — mendukung pertanyaan `numeric` dan `single_choice`. Kuisioner hanya menampilkan pertanyaan yang relevan dengan task terpilih.
- Lihat hasil: rincian mandays **per role** untuk tiap task (satu task bisa melibatkan beberapa role sekaligus, masing-masing dengan level & mandays sendiri), dengan penanda *out-of-range* per role bila jawaban di luar rentang tier, subtotal per kategori, total per level, dan grand total. Tabel hasil juga menampilkan kolom **Biaya** per role = mandays role × rate efektif level role tersebut (bila rate efektif 0, biaya ditampilkan sebagai "—"). Perhitungan bersifat reaktif — berubah otomatis saat pilihan/jawaban/rate berubah.
- Atur rate per level di langkah Hasil untuk melihat estimasi biaya. Rate di langkah Hasil bersifat **override sementara (ephemeral)** atas rate default: SA bisa menimpa rate untuk sesi estimasi saat ini tanpa mengubah rate default, dan tombol **"Reset ke rate default"** mengembalikan ke nilai default. Rate efektif = override sesi bila ada, selain itu rate default konfigurasi, selain itu 0.
- Export hasil sebagai **CSV** di langkah Hasil lewat tombol **"Export CSV"** di bar navigasi (tombol ini menggantikan tombol "Lanjut" di sisi kanan). Format berupa matriks task × level: baris kategori diberi huruf (A, B, C...), task diberi nomor per kategori (A.1, A.2...), mandays tiap role tersebar ke kolom level yang sesuai (satu task multi-role bisa mengisi beberapa kolom), dan baris terakhir "Grand Total" berisi total per level. Tombol nonaktif bila belum ada task terpilih. Export JSON konfigurasi tetap tersedia (di Mode Konfigurasi) untuk custom variable & re-import.

**Peran: General User vs Admin**
Aplikasi membedakan dua peran lewat sebuah **gerbang UI (gate) client-side**:
- **General User** (default, tanpa login): hanya bisa mengakses mode **Estimasi**. Tab **Konfigurasi** tetap terlihat (dengan ikon gembok 🔒), tetapi membukanya memunculkan gerbang login/buat-password, bukan editor konfigurasi.
- **Admin** (setelah login): akses penuh ke Estimasi + Konfigurasi.

Header menampilkan indikator peran ("Mode: General User" / "Mode: Admin") dan tombol **Logout** saat menjadi admin. Sesi admin bersifat **ephemeral** — hilang saat halaman di-reload (harus login lagi).

Alur autentikasi:
- **First-run (belum ada password):** membuka Konfigurasi menampilkan form **"Buat Password Admin"** (password + konfirmasi). Setelah dibuat, langsung masuk sebagai admin. Tidak ada password default yang di-hardcode.
- **Login:** bila password sudah dibuat, membuka Konfigurasi menampilkan form **"Login Admin"**. Password salah menampilkan pesan "Password salah".
- **Ganti password:** tersedia di dalam Konfigurasi (panel di Import/Export), meminta password lama + baru + konfirmasi. Hanya terlihat saat sudah admin.
- **Reset (lupa password):** link "Lupa password? Reset" pada form login menghapus record auth setelah konfirmasi, sehingga Anda bisa membuat password baru. **Konfigurasi TIDAK terhapus** karena disimpan pada key `localStorage` yang berbeda.

> **Batasan keamanan (PENTING).** Ini adalah **gerbang UI praktis untuk pilot, bukan keamanan sungguhan**. Karena aplikasi sepenuhnya client-side, siapa pun yang teknis bisa membuka `localStorage`/DevTools dan melihat record auth atau melewati gate. Password **tidak pernah** disimpan plaintext: yang disimpan hanya **salt acak + hash SHA-256(salt + password)** (Web Crypto) pada key terpisah `mandays-generator:admin-auth`. Record ini **tidak ikut Export JSON** konfigurasi. Untuk keamanan sebenarnya, dibutuhkan autentikasi berbasis backend — di luar cakupan pilot ini.

### Dua mode sumber password admin

Aplikasi mendukung dua mode untuk menentukan password admin:

- **MODE ENV (global, konsisten semua browser)** — aktif bila environment variable `NEXT_PUBLIC_ADMIN_AUTH` diisi (lihat [Deploy ke Vercel](#deploy-ke-vercel)). Password menjadi **global**: sama di semua browser, device, maupun incognito, karena bukan lagi disimpan per-`localStorage`. Dalam mode ini gerbang **selalu** menampilkan form Login (tanpa alur buat-password, ganti password, atau reset dari UI). Ganti password dilakukan dengan memperbarui env var lalu **redeploy**.
- **MODE LOCAL (per-browser)** — aktif bila `NEXT_PUBLIC_ADMIN_AUTH` **tidak** diset. Ini perilaku default: password dibuat first-run dan disimpan di `localStorage` **per-browser**, sehingga di incognito/device lain akan diminta membuat password lagi. Tersedia alur ganti password dan reset (lupa password).

> **Kenapa env var berisi hash, bukan password?** App ini client-side; env var yang dibaca di client **harus** berprefix `NEXT_PUBLIC_` dan nilainya **ter-embed di bundle** JavaScript. Karena itu env var menyimpan **hash** (`salt:hash`), bukan password asli, agar password tidak muncul di bundle/repo. Ini tetap **gerbang UI**, bukan keamanan backend — hash tetap terlihat di bundle bagi yang teknis.

**Mode Konfigurasi**
Mode ini terbagi menjadi empat sub-tab: **Task**, **Kuisioner**, **Rate**, dan **Import/Export**. Hanya bisa diakses setelah login sebagai admin.
- **Task:** CRUD kategori, task, variabel task, dan tier (dengan validasi tolak-simpan bila data tidak valid). Tambah beberapa role per task — tiap role punya level, baseline mandays, dan tier sendiri. Ubah urutan task dalam sebuah kategori lewat tombol geser atas/bawah (↑/↓).
- **Kuisioner:** buat/edit pertanyaan dan petakan ke variabel/tier task. Urutan pertanyaan bisa diubah lewat tombol geser atas/bawah (↑/↓), mirip reorder task.
- **Rate:** atur **rate default** per level staff. Nilai ini **dipersist** (tersimpan di `localStorage`) dan menjadi dasar perhitungan biaya di langkah Hasil, kecuali ditimpa oleh override sesi.
- **Import/Export:** Import JSON (dengan validasi), Export JSON (unduh), dan Reset ke seed data.

Seed data awal berisi 7 kategori dan 71 task hasil ekstraksi dari referensi RACI DMS. Semua nilai bisa diubah sepenuhnya oleh pengguna tanpa mengubah kode.

## Prasyarat

- **Node.js 18+** (disarankan LTS terbaru) dan npm.

## Setup

```bash
cd mandays-generator
npm install
```

## Menjalankan Aplikasi

**Mode development** (hot reload):

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

**Build & jalankan versi production secara lokal:**

```bash
npm run build
npm run start
```

**Menjalankan test** (Vitest — 31 test untuk calculation engine, validasi, dan persistence):

```bash
npm test
```

> Catatan: bila `npm test` menggantung karena lokasi folder (misalnya berada di dalam OneDrive/iCloud dengan spasi pada path), gunakan alternatif berikut yang lebih andal:
>
> ```bash
> npx vitest run --pool=forks --no-isolate
> ```

**Lint / type-check** (TypeScript, tanpa emit):

```bash
npm run lint
```

## Deploy ke Vercel

Aplikasi ini adalah proyek Next.js standar **tanpa environment variable wajib**, jadi deploy-nya langsung. Env var `NEXT_PUBLIC_ADMIN_AUTH` bersifat **opsional** — set bila ingin password admin global (MODE ENV), lewati bila cukup password per-browser (MODE LOCAL).

**Opsi A — via Dashboard Vercel:**
1. Push repository ini ke GitHub/GitLab/Bitbucket.
2. Di [vercel.com](https://vercel.com), pilih **Add New → Project** lalu import repo tersebut.
3. Set **Root Directory** ke `mandays-generator/` (bila repo berisi folder lain di root).
4. Vercel mendeteksi framework **Next.js** secara otomatis — biarkan build command dan output default.
5. (Opsional) Untuk password admin global, tambahkan env var `NEXT_PUBLIC_ADMIN_AUTH` (lihat di bawah).
6. Klik **Deploy**.

**Opsi B — via Vercel CLI:**

```bash
npm i -g vercel
cd mandays-generator
vercel          # deploy preview
vercel --prod   # deploy production
```

### Konfigurasi password admin global (opsional, MODE ENV)

Bila ingin password admin **konsisten di semua browser/device/incognito**, set env var `NEXT_PUBLIC_ADMIN_AUTH`. Nilainya berformat `<saltHex>:<hashHex>` — bukan password plaintext. Buat nilainya dengan skrip generator bawaan (tanpa dependency):

```bash
node scripts/gen-admin-hash.mjs '<password-admin-anda>'
```

Skrip mencetak baris siap pakai, misalnya:

```
NEXT_PUBLIC_ADMIN_AUTH=3f9a...c1:8b2e...ff
```

Lalu di Vercel:
1. Buka **Project Settings → Environment Variables**.
2. Tambahkan variabel `NEXT_PUBLIC_ADMIN_AUTH` dengan **Value** = string `salt:hash` dari skrip (bagian setelah tanda `=`).
3. Pilih environment (Production/Preview/Development) sesuai kebutuhan, simpan.
4. **Redeploy** aplikasi agar nilai baru ter-embed ke bundle.

Setelah mode ENV aktif, gerbang admin **selalu** menampilkan form Login (tanpa buat-password/ganti/reset dari UI), dan **incognito maupun device lain kini konsisten** memakai password yang sama. Untuk **mengganti password**: jalankan ulang skrip dengan password baru, perbarui env var, lalu redeploy.

> **Penegasan keamanan.** Nilai `NEXT_PUBLIC_ADMIN_AUTH` ter-embed di bundle client (itulah sifat prefix `NEXT_PUBLIC_`). Yang di-embed hanyalah **hash**, bukan password asli, sehingga password tidak bocor di bundle/repo — tetapi hash tetap dapat dilihat orang teknis. Ini **tetap gerbang UI client-side**, bukan keamanan berbasis backend. Jangan menaruh password plaintext di env var.

## Struktur Proyek

```
mandays-generator/
├── app/          # App Router: layout & halaman utama (app shell + navigasi mode)
├── components/   # Komponen UI (TaskSelector, Questionnaire, ResultsTable, RatePanel, ConfigEditor, dll.)
├── context/      # ConfigContext — state Config (persisted), Session & Auth (ephemeral)
└── lib/          # Logika inti: types, calc (engine), validation, persistence, auth, seed
```

Penjelasan arsitektur lebih lengkap ada di [architecture.md](./architecture.md).

## Checklist Demo

- [ ] Aplikasi berjalan (`npm run dev`) dan bisa didemokan di browser.
- [ ] Pilih beberapa task lintas lebih dari satu kategori.
- [ ] Isi kuisioner — uji pertanyaan `numeric` dan `single_choice`.
- [ ] Buka Konfigurasi → sub-tab **Rate** dan atur rate default per level, lalu pastikan nilainya tersimpan (persisted).
- [ ] Lihat tabel hasil: rincian mandays per role di tiap task, termasuk penanda *out-of-range* per role saat jawaban di luar rentang tier.
- [ ] Periksa kolom **Biaya** per role di tabel hasil (mandays role × rate efektif; rate 0 tampil "—").
- [ ] Di langkah Hasil, **timpa (override)** rate satu/beberapa level lalu tekan **"Reset ke rate default"** dan pastikan rate kembali ke default konfigurasi.
- [ ] Di langkah Hasil, tekan **"Export CSV"** (tombol di bar navigasi kanan) dan periksa formatnya: penomoran kategori A/B/C, task A.1/A.2, mandays per level, dan baris Grand Total.
- [ ] Buka mode Konfigurasi dan berpindah antar sub-tab (Task, Kuisioner, Rate, Import/Export).
- [ ] Edit sebuah task/tier/pertanyaan, dan pastikan hasil ikut berubah.
- [ ] Tambah role kedua pada sebuah task dan pastikan mandays kedua role muncul di hasil.
- [ ] Geser urutan sebuah task naik/turun dalam kategori dan pastikan urutannya berubah.
- [ ] Di sub-tab Kuisioner, geser urutan sebuah pertanyaan naik/turun dan pastikan urutannya berubah.
- [ ] Uji Export JSON, Import JSON, dan Reset ke seed.
- [ ] Sebagai General User, buka tab **Konfigurasi 🔒** dan pastikan muncul gerbang (buat password/login), bukan editor.
- [ ] First-run: buat password admin, pastikan langsung masuk sebagai admin dan header menampilkan "Mode: Admin".
- [ ] Logout lalu login lagi dengan password yang benar (dan uji pesan "Password salah" dengan password keliru).
- [ ] Ganti password admin (panel di Import/Export), lalu login ulang dengan password baru.
- [ ] Uji "Lupa password? Reset" dan pastikan konfigurasi tetap utuh setelah reset.
- [ ] Export JSON sebagai admin dan konfirmasi record auth (password) TIDAK ikut dalam file.
- [ ] Konfirmasi tidak ada credential yang di-hardcode dan aplikasi tidak butuh environment variable.
