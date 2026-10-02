# CLAUDE.md

Dokumen ini untuk Claude (atau siapa pun) yang membantu melanjutkan project ini di kemudian hari.

## Apa project ini

Sistem redirect untuk kartu NFC/QR "Tap to Review". Pemilik bisnis (Hantic) menjual
kartu NFC fisik ke resto/cafe. Satu kartu = satu URL tetap:

```
https://<domain-vercel-kamu>/c/<kode>
```

Kode ditulis ke chip NFC dan dicetak sebagai QR code di desain kartu **sebelum** tahu
kartu itu nanti dijual ke toko mana. Kartu dicetak massal dulu, baru belakangan
di-assign ke toko tertentu lewat halaman admin — tanpa perlu menulis ulang chip NFC
atau mencetak ulang kartu.

Alur singkat:
1. Generate sekumpulan kode acak (`npm run generate-codes`).
2. Tiap kode dijadikan QR code, ditempel ke desain kartu, dicetak massal.
3. Chip NFC tiap kartu ditulis dengan URL `.../c/<kode>` yang sama (pakai app NFC Tools).
4. Resto/cafe deal → buka `/admin` → cari kode kartu → isi nama toko + link Google
   Review toko tersebut → simpan.
5. Customer tap NFC / scan QR → buka `/c/<kode>` → server cek data kode itu di
   database → redirect 302 ke link Google Review toko yang sesuai.
6. Kalau kode belum di-assign, tampilkan halaman "kartu belum aktif" (bukan error).

## Kenapa butuh web perantara (bukan link Google langsung di kartu)

Karena kartu dicetak sebelum tahu tokonya siapa. Link Google Review beda-beda per
toko (beda Place ID), sedangkan kartu sudah final duluan. Maka kode di kartu harus
tetap (generic), dan "tujuan" kode itu yang diubah belakangan di database — tanpa
menyentuh kartu fisik.

## Stack

- **Next.js (App Router)**, deploy ke **Vercel** (free tier cukup untuk awal).
- **Vercel KV** (Upstash Redis, via marketplace Vercel) sebagai database
  key-value: key = kode kartu, value = `{ storeName, googleReviewUrl, createdAt }`.
- Tidak ada framework admin pihak ketiga — admin page custom, dilindungi password
  tunggal lewat cookie session sederhana (lihat `lib/auth.ts`).

## Keputusan keamanan penting (JANGAN dihapus/diabaikan saat mengubah kode)

1. **Open redirect whitelist** — `lib/redirect.ts` memvalidasi bahwa
   `googleReviewUrl` yang disimpan HARUS berawalan `https://search.google.com/`
   atau `https://www.google.com/`. Tujuannya mencegah kode ini disalahgunakan
   untuk phishing (redirect ke domain sembarang). Validasi ini jalan di DUA
   tempat: saat admin menyimpan data (tolak kalau bukan domain google), dan saat
   redirect dieksekusi (safety net kedua).
2. **Kode kartu acak**, bukan angka urut (`a8f3k2`, bukan `001`), supaya orang
   tidak bisa menebak-nebak dan melihat daftar toko klien hanya dengan mengetik
   angka berurutan di URL. Lihat `scripts/generate-codes.mjs`.
3. **Admin panel wajib login** — route `/admin/*` dan API `/api/admin/*` dicek
   cookie session yang dibuat setelah login dengan `ADMIN_PASSWORD` (env var).
   Jangan pernah membuat endpoint yang bisa mengubah data tanpa cek session ini.
4. **Rate limit sederhana** pada endpoint login (lihat `lib/auth.ts`) untuk
   memperlambat brute force password admin.

## Environment variables (diisi di dashboard Vercel, bukan di-commit)

```
ADMIN_PASSWORD=          # password untuk login ke /admin
SESSION_SECRET=          # string acak panjang, untuk tanda tangan cookie session
KV_REST_API_URL=         # otomatis terisi saat connect Vercel KV / Upstash
KV_REST_API_TOKEN=       # otomatis terisi saat connect Vercel KV / Upstash
```

## Struktur folder

```
app/
  c/[code]/route.ts        -> redirect handler (publik)
  admin/page.tsx           -> UI admin (list + form assign kode->toko)
  admin/login/page.tsx     -> form login admin
  api/admin/login/route.ts -> cek password, set cookie session
  api/admin/logout/route.ts
  api/admin/codes/route.ts -> GET (list semua kode), POST (create/update satu kode)
lib/
  kv.ts                    -> wrapper baca/tulis Vercel KV
  auth.ts                  -> cek session, buat/validasi cookie
  redirect.ts              -> whitelist domain google, dipakai admin & redirect route
scripts/
  generate-codes.mjs       -> generate N kode acak, print daftar URL siap jadi QR
```

## Cara jalan lokal

```bash
npm install
cp .env.example .env.local   # isi ADMIN_PASSWORD, SESSION_SECRET
npm run dev
```

Tanpa `KV_REST_API_URL`/`KV_REST_API_TOKEN` terisi, fitur baca/tulis kode akan
gagal — development penuh butuh koneksi ke Vercel KV (lihat `lib/kv.ts`, ada
fallback in-memory untuk testing cepat tapi datanya hilang tiap restart).

## Cara deploy ke Vercel

1. Push repo ini ke GitHub (lihat instruksi di README.md).
2. Di dashboard Vercel: Import Project dari repo GitHub ini.
3. Tambahkan Vercel KV (Storage tab -> Create Database -> KV) dan connect ke
   project ini -> env var KV_* otomatis terisi.
4. Isi env var `ADMIN_PASSWORD` dan `SESSION_SECRET` manual di Project Settings
   -> Environment Variables.
5. Deploy. Domain default `*.vercel.app` bisa langsung dipakai untuk testing;
   custom domain opsional untuk tahap produksi.

## Cara generate kode kartu baru

```bash
node scripts/generate-codes.mjs 20
```

Akan print 20 kode acak beserta URL lengkapnya (`https://<domain>/c/<kode>`).
Kode-kode ini:
1. Dijadikan QR code satu per satu (pakai generator QR apa saja, paste URL-nya).
2. Ditempel ke desain kartu sebelum cetak massal.
3. Ditulis ke chip NFC (app NFC Tools -> Write -> URL -> paste URL yang sama).

Kode BELUM otomatis masuk ke database KV saat di-generate — baru benar-benar
"ada" di sistem begitu di-assign lewat halaman `/admin` saat toko deal. Men-tap
kartu yang kodenya belum pernah di-assign akan menampilkan halaman "kartu belum
aktif", bukan error.

## Yang masih perlu dikerjakan / belum ada

- Belum ada fitur cari Place ID otomatis dari nama toko di halaman admin (masih
  manual: Hantic cari sendiri via Google Place ID Finder, lalu paste link
  `search.google.com/local/writereview?placeid=...` ke form admin).
- Belum ada analytics (jumlah tap per kartu, dsb).
- Belum ada multi-admin/role, cuma satu password tunggal.
