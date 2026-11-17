# CLAUDE.md

Lihat `AGENTS.md`, `PRD.md`, dan `SKILLS.md` sebagai acuan utama arsitektur, aturan desain Obsidian Slate (Tailwind CSS + `lucide-react`, tanpa emoji dan tanpa komentar di dalam kode), serta spesifikasi fitur terbaru.

## Ringkasan Cepat
- **Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Vercel KV (`@vercel/kv`).
- **Route Utama**:
  - `app/c/[code]/route.ts`: redirect publik (+ mode tes `?preview=1` khusus admin terautentikasi & Instagram deep-link bridge).
  - `app/admin/(protected)/page.tsx`: Dashboard ringkasan & form assign kartu.
  - `app/admin/(protected)/cards/page.tsx`: Daftar & kelola kartu toko (Tabel/Kartu, quick edit HPP).
  - `app/admin/(protected)/stock/page.tsx`: Manajemen stok kartu fisik & assign 1-klik.
  - `app/admin/(protected)/taps/page.tsx`: Analitik tap (Tren & Jam, Riwayat, Leaderboard, Kartu Pasif).
  - `app/admin/(protected)/print/page.tsx`: Studio cetak batch QR & auto-simpan ke stok.
