# Mandays Generator

Aplikasi web untuk membantu **Solution Architect (SA)** menyusun estimasi mandays sebuah project. SA memilih kategori & task yang relevan, menjawab kuisioner, lalu aplikasi menghitung mandays per task, per kategori, dan total — sekaligus mengalokasikannya ke level staff (mis. General Engineer vs Sr. Engineer) dan menghitung estimasi biaya opsional berbasis rate.

Aplikasi ini adalah MVP untuk pilot: berjalan **sepenuhnya di browser (client-side)**, tanpa backend maupun database. Konfigurasi disimpan di `localStorage` browser dan bisa di-import/export sebagai JSON. Deploy ke Vercel tanpa environment variable.

## Fitur Inti

**Mode Estimasi** (alur 3 langkah: Pilih → Kuisioner → Hasil)
- Pilih kategori & task lintas kategori (default tidak tercentang), dengan aksi cepat "centang semua" / "kosongkan semua" per kategori.
- Isi kuisioner per kategori — mendukung pertanyaan `numeric` dan `single_choice`. Kuisioner hanya menampilkan pertanyaan yang relevan dengan task terpilih.
- Lihat hasil: rincian mandays **per role** untuk tiap task (satu task bisa melibatkan beberapa role sekaligus, masing-masing dengan level & mandays sendiri), dengan penanda *out-of-range* per role bila jawaban di luar rentang tier, subtotal per kategori, total per level, dan grand total. Perhitungan bersifat reaktif — berubah otomatis saat pilihan/jawaban berubah.
- Atur rate per level (opsional) untuk melihat estimasi biaya per level dan grand total biaya.

**Mode Konfigurasi**
- CRUD kategori, task, variabel task, dan tier (dengan validasi tolak-simpan bila data tidak valid).
- Tambah beberapa role per task — tiap role punya level, baseline mandays, dan tier sendiri.
- Ubah urutan task dalam sebuah kategori lewat tombol geser atas/bawah (↑/↓).
- Editor kuisioner: buat/edit pertanyaan dan petakan ke variabel/tier task.
- Import JSON (dengan validasi), Export JSON (unduh), dan Reset ke seed data.

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

**Menjalankan test** (Vitest — 26 test untuk calculation engine, validasi, dan persistence):

```bash
npm test
```

**Lint / type-check** (TypeScript, tanpa emit):

```bash
npm run lint
```

## Deploy ke Vercel

Aplikasi ini adalah proyek Next.js standar **tanpa environment variable wajib**, jadi deploy-nya langsung.

**Opsi A — via Dashboard Vercel:**
1. Push repository ini ke GitHub/GitLab/Bitbucket.
2. Di [vercel.com](https://vercel.com), pilih **Add New → Project** lalu import repo tersebut.
3. Set **Root Directory** ke `mandays-generator/` (bila repo berisi folder lain di root).
4. Vercel mendeteksi framework **Next.js** secara otomatis — biarkan build command dan output default. Tidak perlu menambahkan env var.
5. Klik **Deploy**.

**Opsi B — via Vercel CLI:**

```bash
npm i -g vercel
cd mandays-generator
vercel          # deploy preview
vercel --prod   # deploy production
```

## Struktur Proyek

```
mandays-generator/
├── app/          # App Router: layout & halaman utama (app shell + navigasi mode)
├── components/   # Komponen UI (TaskSelector, Questionnaire, ResultsTable, RatePanel, ConfigEditor, dll.)
├── context/      # ConfigContext — state Config (persisted) & Session (ephemeral)
└── lib/          # Logika inti: types, calc (engine), validation, persistence, seed
```

Penjelasan arsitektur lebih lengkap ada di [architecture.md](./architecture.md).

## Checklist Demo

- [ ] Aplikasi berjalan (`npm run dev`) dan bisa didemokan di browser.
- [ ] Pilih beberapa task lintas lebih dari satu kategori.
- [ ] Isi kuisioner — uji pertanyaan `numeric` dan `single_choice`.
- [ ] Lihat tabel hasil: rincian mandays per role di tiap task, termasuk penanda *out-of-range* per role saat jawaban di luar rentang tier.
- [ ] Atur rate per level dan verifikasi estimasi biaya (per level + grand total) muncul.
- [ ] Buka mode Konfigurasi, edit sebuah task/tier/pertanyaan, dan pastikan hasil ikut berubah.
- [ ] Tambah role kedua pada sebuah task dan pastikan mandays kedua role muncul di hasil.
- [ ] Geser urutan sebuah task naik/turun dalam kategori dan pastikan urutannya berubah.
- [ ] Uji Export JSON, Import JSON, dan Reset ke seed.
- [ ] Konfirmasi tidak ada credential yang di-hardcode dan aplikasi tidak butuh environment variable.
