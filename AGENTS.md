# AGENTS.md: Panduan Kerja Agent untuk Review Card (Hantic)

Dokumen ini adalah aturan kerja wajib bagi seluruh AI agent dan developer yang memodifikasi repositori `google_review_card`.

## 1. Gambaran Sistem & Stack
- **Framework**: Next.js 14 (App Router), React 18, TypeScript strict.
- **Styling**: Tailwind CSS + token tema di `app/styles/tokens.css` (jangan kembalikan CSS monolit di `globals.css`).
- **Ikonografi**: `lucide-react` secara eksklusif.
- **Database**: Vercel KV / Upstash Redis (`lib/kv.ts`) dengan fallback in-memory untuk pengembangan lokal.
- **Domain Fitur**:
  - Redirect publik & bridge Instagram mobile: `app/c/[code]/route.ts`, `lib/redirect.ts`.
  - Admin Dashboard, Manajemen Kartu, Manajemen Stok, Analitik Tap, dan Print Studio QR: `app/admin/*`.
  - API terproteksi sesi cookie HMAC: `app/api/admin/*`.

## 2. Invarian Keamanan & Data (Pantang Dilanggar)
1. **Whitelist Redirect**: Seluruh URL tujuan wajib lolos `isAllowedReviewUrl()` di `lib/redirect.ts` (host resmi Google/Instagram tanpa userinfo `@` maupun path open-redirector) saat disimpan (`POST /api/admin/codes`) dan saat redirect dieksekusi (`GET /c/[code]`). Data skrip di HTML bridge wajib memakai `safeJsonForScript()`.
2. **Proteksi Admin & Anti-CSRF**:
   - Semua route handler di `app/api/admin/*` (kecuali `/api/admin/login` dan `/api/admin/logout`) wajib memeriksa `await isAdminLoggedIn()`.
   - Semua endpoint mutasi admin (`POST`, `DELETE`) wajib memeriksa `isValidSameOrigin(req)` dan `/api/admin/login` memakai `isRateLimitedAsync()`.
   - Semua halaman `/admin/*` (kecuali `/admin/login`) harus berada di bawah proteksi server auth guard.
3. **Integritas Statistik Preview & Anti-Bot**: Mode test redirect (`?preview=1` pada `/c/[code]`) hanya boleh melewati pencatatan tap (`incrementTapCount` / `addTapLog`) apabila `await isAdminLoggedIn()` bernilai `true`; request `HEAD`, HTTP prefetch, dan bot preview tautan juga dikecualikan agar metrik tetap akurat.
4. **Header Anti-Cache pada Redirect**: Respons `/c/[code]` wajib mempertahankan `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` agar NFC tap selalu membaca tujuan terbaru.
5. **Tanpa API Berbayar Eksternal**: Jangan menambahkan integrasi Google Places API berbayar yang memerlukan billing. Gunakan parser URL & Place ID lokal.

## 3. Aturan Kualitas Kode & Anti-AI-Slop
1. **Dilarang Memakai Emoji**: Jangan menulis karakter emoji di teks UI, label tombol, log, HTML string, atau kode TypeScript/CSS. Gunakan komponen ikon `lucide-react`.
2. **Dilarang Menulis Komentar di Dalam Kode**: Kode harus *self-documenting* lewat penamaan fungsi, tipe, dan variabel yang jelas. Jangan menaruh komentar `//`, `/* */`, atau `{/* */}` di file source code yang ditulis atau direfaktor.
3. **Dilarang Memakai Simbol Tipografi AI / Dekoratif**: Jangan menulis simbol dekoratif bergaya AI seperti em-dash (`U+2014`), en-dash (`U+2013`), middot (`U+00B7`), bullet unicode (`U+2022`), panah teks (`U+2192`, `U+2190`, `U+2197`), atau tanda `-` sebagai pemisah frasa di teks UI, label tombol, judul HTML, pesan error, maupun dokumentasi. Gunakan titik dua, koma, tanda kurung, kata penghubung (`s/d`, `sampai`, `menjadi`, `ke`), atau komponen ikon `lucide-react`.
4. **Dark Mode Obsidian Slate yang Nyaman**:
   - Gunakan token latar `#0B0D12`, surface `#12151E`, elevated `#191D28`, teks `#E6EAF2`, dan border halus `rgba(255,255,255,0.08)`.
   - Dilarang menambah `.gradient-blob`, *neon box-shadow glow*, atau menumpuk kotak bergradien di dalam kartu.
   - Angka uang, kode, persentase, dan jumlah tap wajib memakai `tabular-nums`.
5. **Modularitas & Struktur File**:
   - Pisahkan logika/komponen agar file halaman tidak membengkak; komponen bersama ditaruh di `app/admin/components/` atau folder fitur terkait (`app/admin/_features/`).
   - Gunakan kelas Tailwind CSS untuk layout, grid responsif, spacing, dan state hover/focus. Hindari inline `style={{ ... }}` kecuali nilai dinamis murni (misal lebar bar persentase atau koordinat canvas).
6. **Responsif Nyaman di Desktop & Mobile**:
   - Header halaman admin tetap bersih tanpa kalimat pengantar deskriptif di bawah judul.
   - Stok Kartu dan grafik Tren & Jam di Analitik Tap hanya ditampilkan pada layar desktop (`md:` ke atas) agar tampilan mobile ringkas.
   - Tambah kartu dan akses Scan QR di mobile Dashboard memakai Floating Action Button (`+`).
   - Pastikan target sentuh interaktif di mobile memadai (`min-h-[44px]` pada tombol aksi utama) dan bottom dock memperhitungkan `safe-area-inset-bottom`.
7. **Bahasa Indonesia**: Seluruh copywriting UI menggunakan Bahasa Indonesia yang ringkas, lugas, dan konsisten.

## 4. Referensi & Skills
- Spesifikasi lengkap fitur dan UI ada di `PRD.md`.
- Sebelum mengerjakan UI, alur kartu/analitik, atau mesin cetak QR, baca skill terkait di `.agents/skills/*/SKILL.md` (terindeks di `SKILLS.md`).

## 5. Verifikasi Wajib & Auto-Push GitHub
Setiap perubahan wajib diverifikasi dengan:
1. `npx tsc --noEmit` (nol error tipe).
2. `npm run build` (build produksi Next.js sukses).
3. Pemeriksaan ulang bahwa tidak ada emoji, komentar baru, atau simbol tipografi dekoratif di dalam file kode maupun dokumentasi yang diubah.
4. **Auto-Push ke GitHub**: Setelah seluruh verifikasi di atas dipastikan lulus tanpa error, periksa `git status` dan daftar file ter-stage agar tidak ada file rahasia (seperti `.env.local`) atau build artifact (`.next/`, `node_modules/`), lalu langsung `git add`, `git commit` dengan pesan yang jelas dalam Bahasa Indonesia, dan `git push` ke branch `main` di remote `origin`.
