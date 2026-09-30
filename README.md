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

**Mode Konfigurasi**
Mode ini terbagi menjadi empat sub-tab: **Task**, **Kuisioner**, **Rate**, dan **Import/Export**.
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
- [ ] Konfirmasi tidak ada credential yang di-hardcode dan aplikasi tidak butuh environment variable.
