# PRD: Redesign & Peningkatan Produk Review Card (Hantic)

## 1. Ringkasan Produk

**Review Card (Hantic)** adalah sistem manajemen dan *redirect* pintar untuk kartu fisik NFC/QR berbasis Next.js App Router dan Vercel KV (Upstash Redis). Kartu dicetak massal terlebih dahulu dengan kode unik acak (`/c/<code>`), lalu di-assign ke toko/kafe saat penjualan terjadi tanpa perlu menulis ulang chip NFC atau mencetak ulang kartu.

Dokumen ini merancang perombakan antarmuka (*de-slopification*), modularisasi kode dengan Tailwind CSS, serta penambahan fitur operasional inti agar aplikasi lebih nyaman dipakai di desktop maupun mobile.

---

## 2. Masalah yang Diselesaikan

### 2.1 Masalah Visual & Ergonomi (AI Slop Audit)
1. **Estetika Gelap Generik & Melelahkan Mata**: Warna dasar sangat gelap bercampur *ambient neon blobs*, glow ungu berlebihan, dan kontras warna aksen yang terlalu ramai dalam satu layar.
2. **Emoji sebagai Pengganti Ikonografi**: Penggunaan emoji sistem OS di navigasi, badge, tombol, grafik, dan modal membuat UI tidak seragam antar perangkat dan terkesan seperti prototipe.
3. **Kepadatan Informasi & *Card-inside-Card***: Halaman daftar kartu menumpuk terlalu banyak kotak bersarang, gradien, dan tombol sekaligus sehingga sulit dipindai cepat.
4. **CSS & Monolith Membengkak**: `app/globals.css` lebih dari 5.000 baris penuh `!important`, serta file halaman mencapai 1.200 sampai 5.200 baris dengan duplikasi form dan modal antar halaman.
5. **Kesenjangan Mobile vs Desktop**: Tab analitik **Tren & Jam** disembunyikan di mobile, padahal pengecekan performa sering dilakukan dari HP saat di lapangan.

### 2.2 Masalah Fungsional & Operasional
1. **Stok Kartu Fisik Tidak Terpantau di UI**: Backend `/api/admin/stock` sudah menyimpan kode dari Print Studio dan menghapusnya saat kartu di-assign, tetapi belum ada halaman untuk melihat sisa stok, kode siap pakai, atau peringatan saat stok menipis.
2. **Testing Link Mengotori Statistik**: Saat admin membuka `/c/<code>` untuk memastikan redirect berfungsi, sistem ikut mencatat hitungan tap dan log seolah-olah pelanggan asli yang melakukan tap.
3. **Input Place ID Belum Fleksibel**: Admin sering menyalin berbagai format URL Google Maps, bukan hanya Place ID mentah, namun tidak menggunakan Google Places API berbayar karena risiko billing.
4. **Auth Guard Belum Seragam**: Baru `/admin` yang memakai pengecekan sesi di sisi server, sementara sub-halaman admin lain langsung merender komponen client sebelum verifikasi sesi.

---

## 3. Target Pengguna & Konteks Pakai

| Persona | Perangkat Utama | Konteks Penggunaan | Kebutuhan Utama |
| :--- | :--- | :--- | :--- |
| Operator Lapangan | Mobile (360 s/d 430px) | Saat meeting/deal di kafe klien | Scan QR cepat, pilih kode dari stok siap pakai, assign toko, tes redirect aman |
| Admin Studio / Pemilik | Desktop (1280px+) | Operasional harian & cetak | Scan banyak toko lewat tabel/grid, cek margin & HPP, pantau tren jam ramai, cetak batch QR |
| Pengunjung Toko | Mobile Webview | Tap NFC / scan QR di meja kasir | Redirect instan (<200ms) ke Google Review atau bridge Instagram yang bersih & terpercaya |

---

## 4. Prinsip Desain UI/UX (Anti-AI-Slop & Nyaman di Mata)

### 4.1 Sistem Warna: Obsidian Slate Dark Mode
- **Latar Dasar (`--bg-base`)**: `#0B0D12` (charcoal netral, tidak hitam pekat agar tidak menimbulkan *halation* pada teks terang).
- **Surface Tingkat 1 (`--bg-surface`)**: `#12151E` untuk kartu utama dan sidebar.
- **Surface Tingkat 2 (`--bg-elevated`)**: `#191D28` untuk input, dropdown, dan modal.
- **Border Hairline**: `rgba(255, 255, 255, 0.08)` default, `rgba(255, 255, 255, 0.15)` hover.
- **Tipografi Kontras Nyaman**:
  - Utama: `#E6EAF2` (off-white lembut, bukan `#FFFFFF` tajam untuk body text).
  - Sekunder: `#9BA3B4`.
  - Redup/Muted: `#667085`.
- **Aksen Terkendali**:
  - Primer: Indigo tenang `#6366F1` (tanpa neon `box-shadow` glow atau blob blur melayang).
  - Semantik: Emerald (`#10B981` / `#34D399`) untuk status aktif & profit; Amber (`#F59E0B` / `#FBBF24`) untuk peringatan HPP / stok rendah / review; Rose (`#F43F5E` / `#FB7185`) untuk aksi destruktif & target Instagram.

### 4.2 Aturan UI Terstandar
1. **Zero Emoji di Seluruh UI & Kode**: Gunakan ikon vektor `lucide-react` secara konsisten (`strokeWidth={1.75}` atau `2`).
2. **Tipografi & Angka**: Gunakan `Inter` (atau `Plus Jakarta Sans`) + `JetBrains Mono` via `next/font/google`, serta kelas `tabular-nums` untuk seluruh nominal Rupiah, kode kartu, persentase, dan jumlah tap.
3. **Hierarki Grid Responsif**:
   - **Mobile**: Flow 1 kolom yang lega, KPI ringkas 2 kolom bila mudah dibaca, bottom dock navigasi dengan `safe-area-inset-bottom`, target sentuh minimal `44px`.
   - **Desktop**: Container maksimal `1280px` (`max-w-7xl`), layout multi-kolom asimetris untuk workspace utama (form + live feed, grid/table daftar kartu, dual-pane Print Studio), tanpa ruang terbuang.
4. **Pemisahan CSS & Tailwind**: Gunakan Tailwind CSS untuk layout, spacing, tipografi, dan state interaktif. Pisahkan CSS khusus (token variabel warna, scrollbar halus, animasi scanner/print) ke modul kecil di `app/styles/`, hapus monolit `globals.css`.

---

## 5. Lingkup Fitur & Spesifikasi Fungsional

### 5.1 Fitur Baru & Peningkatan Inti (Masuk Lingkup)
1. **Manajemen Stok Kartu Fisik (`/admin/stock`)**:
   - Menampilkan total stok kode kartu siap jual yang tersimpan di `stok:_index`.
   - Pencarian kode stok, tambah kode stok cepat (manual/batch acak), hapus kode satuan, dan bersihkan stok (dengan konfirmasi).
   - **Aksi Assign 1-Klik**: Klik "Gunakan Kode" langsung mengarahkan ke form Hubungkan Kartu dengan kode terisi otomatis.
   - **Indikator Stok Menipis**: Peringatan di Dashboard dan navbar/badge stok bila sisa stok di bawah ambang batas (mis. `<= 10` kartu) agar operator siap cetak ulang sebelum habis.
2. **Test Redirect Tanpa Mengotori Statistik (`?preview=1`)**:
   - Endpoint `GET /c/<code>` mendukung parameter `?preview=1` **hanya jika** sesi cookie admin valid (`isAdminLoggedIn()`).
   - Ketika mode preview aktif, server tetap melakukan validasi kartu dan redirect (atau menampilkan bridge Instagram), tetapi **melewati** `incrementTapCount` dan `addTapLog`.
   - Tombol **"Tes Link"** di Dashboard & Daftar Kartu otomatis membuka `/c/<code>?preview=1` disertai keterangan bahwa tap tidak dihitung.
   - Jika pengguna eksternal mencoba `?preview=1` tanpa login admin, tap tetap tercatat seperti biasa.
3. **Smart Google Maps & Place ID Parser (Zero-Billing)**:
   - Input tujuan Google Review menerima Place ID langsung (`ChIJ...`), URL `placeid=...`, maupun tautan Google Maps / pencarian toko.
   - Helper pencarian langsung membuka Google Place ID Finder / Google Maps dengan nama toko yang sudah terisi otomatis di query URL tanpa API berbayar Google Cloud.
4. **Redesign Dashboard (`/admin`)**:
   - KPI Ringkas (Kartu Aktif, Total Tap, Keuntungan Bersih dengan `col-span-2` di mobile, serta Sisa Stok Kartu khusus desktop `md:` ke atas).
   - Header bersih tanpa subjudul panjang; tombol hubungkan kartu & Scan QR di header mobile diganti dengan Floating Action Button (`+`) yang membuka form kartu lengkap (termasuk Scan QR).
   - Panel Aktivitas Tap Terbaru dengan tata letak dua baris adaptif di mobile (nama toko penuh + waktu rapi tanpa terpotong), tombol refresh, dan tes redirect aman.
5. **Redesign Manajemen Kartu (`/admin/cards`)**:
   - Di desktop (`lg:` ke atas), tersedia **Mode Tabel** ringkas dan **Mode Kartu Grid** dengan aksi 1x4 lengkap.
   - Di mobile (`< lg`), memakai **Kartu Ringkas Interaktif** (ikon platform Google/Instagram pembeda visual, tipografi lebih besar, tombol cepat `Reset Tap` & `Tes`, plus drawer `Kelola` yang bisa dibuka untuk Unduh QR, Edit, Salin Link NFC, Hapus, dan rincian HPP), serta bar Cari + Urutkan sejajar horizontal dan filter chip cepat.
   - **Quick Modal (HPP) Edit**: Kartu yang belum memiliki modal awal menampilkan aksi cepat agar operator bisa langsung melengkapi HPP tanpa kebingungan.
6. **Redesign Analitik Tap (`/admin/taps`)**:
   - Halaman bawaan langsung membuka **Riwayat Tap Hari Ini** agar pengecekan aktivitas harian cepat diakses, disertai tombol sinkronkan ringkas di header dan filter tanggal sejajar di mobile.
   - Di desktop (`md:` ke atas), seluruh 4 tampilan (**Riwayat Tap**, **Leaderboard Toko**, **Belum Ada Tap**, **Tren & Jam**) tersedia dengan drilldown 3 level serta grafik batang berwarna tenang (Emerald untuk batang tertinggi, Sky untuk periode berjalan, Indigo Slate untuk lainnya).
   - Di mobile (`< md`), tampilan dipadatkan menjadi 3 tab utama (**Riwayat**, **Peringkat**, **Pasif**) tanpa grafik Tren & Jam agar cepat dibaca di layar kecil, dengan baris riwayat tap responsif 2 baris yang rapi.
   - Hapus kode mati laporan klien WhatsApp/print handout yang tidak digunakan.
7. **Redesign Print Studio (`/admin/print`)**:
   - Pertahankan seluruh mesin canvas (Template Standar Hantic vs Upload Desain Klien, auto-detect & hapus dummy QR, *center in slot*, custom dot style/logo/warna, upscale 1x s/d 4x, unsharp mask, export PNG/ZIP, auto-save ke stok).
   - Tata ulang layout menjadi dual-pane studio yang rapi dan nyaman di layar lebar.
8. **Redesign Halaman Publik (`/c/[code]`) & Login (`/admin/login`)**:
   - Tampilan `NOT_ACTIVE_HTML`, `retryHtml`, `instagramBridgeHtml`, dan halaman login mengikuti palet Obsidian Slate yang bersih, ringan, dan bebas blob/emoji.
9. **Server Auth Guard Menyeluruh**:
   - Seluruh route di bawah `/admin` (kecuali `/admin/login`) dilindungi pengecekan `isAdminLoggedIn()` di sisi server melalui layout terproteksi.

### 5.2 Di Luar Lingkup (Explicit Non-Goals)
1. **Integrasi Google Places API berbayar** (menghindari biaya billing Google Cloud).
2. **Halaman/Link Laporan Publik ke Klien** (klien memantau review langsung dari Google Business Profile).
3. **Simpan Preset Desain Kustom di Print Studio** (cukup pengaturan sesi aktif dan `localStorage` standar saat ini).

---

## 6. Kriteria Penerimaan (Acceptance Criteria)
1. `npm run build` dan pemeriksaan TypeScript (`npx tsc --noEmit`) lulus tanpa error.
2. Tidak ada satupun emoji di UI yang dirender maupun komentar di dalam file kode baru/refaktor.
3. Seluruh CSS terstruktur rapi menggunakan Tailwind CSS + file CSS modular kecil (tidak ada lagi CSS monolitik ribuan baris).
4. Keamanan redirect (`lib/redirect.ts`), auth (`lib/auth.ts`), dan pencatatan KV (`lib/kv.ts`) tetap berjalan dengan perilaku yang akurat, termasuk fitur `?preview=1` yang hanya melewati pencatatan jika admin terautentikasi.
5. Setiap halaman admin nyaman di desktop (`1280px+`) dan mobile (`375px`) tanpa horizontal overflow atau teks/tombol terpotong.
6. Setiap perubahan yang sudah dikonfirmasi lulus seluruh pemeriksaan (`npx tsc --noEmit`, `npm run build`, serta bebas emoji/komentar/simbol dekoratif) langsung di-commit secara aman tanpa file rahasia dan di-push ke repository GitHub (`origin/main`).
