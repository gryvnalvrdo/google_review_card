# CLAUDE.md

Lihat `AGENTS.md`, `PRD.md`, dan `SKILLS.md` sebagai acuan utama arsitektur, aturan desain Obsidian Slate (Tailwind CSS + `lucide-react`, tanpa emoji dan tanpa komentar di dalam kode), serta spesifikasi fitur terbaru.

## Ringkasan Cepat
- **Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Vercel KV (`@vercel/kv`).
- **Route Utama**:
  - `app/c/[code]/route.ts`: redirect publik (+ mode tes `?preview=1` khusus admin terautentikasi & Instagram deep-link bridge).
  - `app/admin/(protected)/page.tsx`: Dashboard ringkasan & form assign kartu.
  - `app/admin/(protected)/cards/page.tsx`: Daftar & kelola kartu toko (Tabel/Kartu desktop, Kartu Interaktif mobile, quick edit HPP).
  - `app/admin/(protected)/taps/page.tsx`: Analitik tap (default Riwayat Tap Hari Ini; Tren & Jam di desktop).
  - `app/admin/(protected)/print/page.tsx`: Studio cetak batch QR & auto-simpan kode sementara (hapus otomatis setelah 90 hari bila belum di-assign).
