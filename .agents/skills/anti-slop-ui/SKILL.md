---
name: anti-slop-ui
description: >-
  Gunakan skill ini setiap kali merancang, membuat, atau merombak tampilan UI,
  layout grid responsif, atau komponen Tailwind CSS di aplikasi Review Card.
---

# Anti-Slop UI & Design System Skill

Skill ini memastikan seluruh antarmuka admin dan halaman publik mengikuti standar estetika **Obsidian Slate Dark Mode** yang tenang, tajam, bebas emoji, dan konsisten antara desktop serta mobile.

## Aturan Keras (Wajib Dicek)

1. **Nol Emoji, Nol Komentar, Nol Simbol Dekoratif AI**:
   - Semua ikon UI memakai `lucide-react`.
   - Tidak ada emoji di JSX, string pesan, title HTML, maupun konstanta label.
   - Tidak ada simbol dekoratif seperti em-dash (`U+2014`), en-dash (`U+2013`), middot (`U+00B7`), bullet unicode (`U+2022`), panah teks, atau tanda `-` sebagai pemisah kalimat di JSX maupun string pesan UI; gunakan koma, titik dua, atau ikon `lucide-react`.
   - Tidak ada komentar di file `.ts`, `.tsx`, dan `.css`.
2. **Tailwind CSS & Token Terstruktur**:
   - Gunakan kelas Tailwind untuk layout (`grid`, `flex`, `gap-*`, `p-*`), tipografi, border, dan responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
   - Warna tema utama mengikuti variabel di `app/styles/tokens.css` (`bg-canvas`, `bg-surface`, `bg-elevated`, `text-ink`, `text-muted`, `border-hairline`).
3. **Hindari Pola AI Slop**:
   - Tidak ada `.gradient-blob` melayang, blur neon, atau `box-shadow` glow berwarna.
   - Tidak ada kotak bersarang (*card-inside-card*) dengan banyak border berwarna.
   - Gunakan maksimal 1 warna aksen primer (`indigo`) ditambah warna semantik seperlunya (`emerald` aktif/profit, `amber` peringatan/review, `rose` hapus/Instagram).
4. **Tipografi & Angka Rapi**:
   - Nominal `Rp`, kode kartu, waktu, dan jumlah tap wajib memakai `tabular-nums`.
   - Kode kartu memakai font monospace (`font-mono`).

## Checklist Layout Desktop & Mobile

1. **Desktop (`lg:` ke atas)**:
   - Manfaatkan ruang horizontal: gunakan layout 2 kolom asimetris (form/inspector tetap terjangkau di samping data utama) atau tampilan tabel terstruktur untuk memindai daftar panjang.
   - Lebar kontainer maksimal `max-w-7xl mx-auto` agar teks tidak terlalu panjang melebar.
2. **Mobile (`< md` / `< lg`)**:
   - Flow 1 kolom yang bersih dengan padding horizontal konsisten (`px-4`), tanpa overflow horizontal, dan tanpa kalimat pengantar 1 baris di bawah `h1`.
   - KPI grid 2 kolom hanya jika label dan nominal tidak terpotong; nominal panjang (keuntungan/omzet) diberi ruang penuh (`col-span-2` bila perlu).
   - Tab grafik **Tren & Jam** tidak ditampilkan di mobile agar navigasi serta analitik mobile fokus pada **Riwayat**, **Peringkat**, dan **Pasif**, tanpa menu atau halaman stok terpisah.
   - Di Dashboard mobile, pemicu tambah kartu/Scan QR menggunakan Floating Action Button (`+`) di sudut kanan bawah di atas bottom dock (`bottom-24`).
   - Beri jarak bawah ekstra pada kontainer utama agar konten terakhir tidak tertutup mobile bottom dock (`pb-28 lg:pb-12`).
3. **Modal & Drawer**:
   - Gunakan `max-h-[90dvh]` dengan area scroll internal dan header/footer sticky agar nyaman di keyboard mobile.

## Verifikasi

1. Pastikan ukuran tiap file komponen wajar dan terpecah rapi.
2. Jalankan `npx tsc --noEmit` dan `npm run build` setelah perubahan UI.
