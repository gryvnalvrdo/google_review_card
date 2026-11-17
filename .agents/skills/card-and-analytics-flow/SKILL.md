---
name: card-and-analytics-flow
description: >-
  Gunakan skill ini saat mengubah alur kartu toko, manajemen stok, validasi target
  Google Review/Instagram, mode tes redirect, atau perhitungan analitik tap.
---

# Card, Stock & Analytics Workflow Skill

Skill ini menjaga konsistensi alur data antara `lib/kv.ts`, `lib/redirect.ts`, API routes `/api/admin/*`, dan UI admin.

## Langkah & Aturan Inti

1. **Kode Cetak Sementara (Auto-Delete 90 Hari) & Assign Kartu**:
   - Kode yang dicetak dari Print Studio disimpan ke Redis ZSET `stok:_timed` melalui `POST /api/admin/stock` dan otomatis dihapus server apabila belum dihubungkan ke toko melewati 90 hari (3 bulan).
   - Saat kartu disimpan melalui `POST /api/admin/codes`, `removeStokCode(code)` otomatis memindahkan kode tersebut menjadi kartu aktif permanen di `card:_index`.
   - Form assign selalu mengambil daftar kode cetak aktif (`< 90 hari`) via `/api/admin/stock` dengan `cache: "no-store"`.
2. **Target Google Review & Instagram (Zero-Billing)**:
   - Terima input Place ID mentah (`ChIJ...`), link Google Review (`placeid=...`), atau URL Google Maps umum via parser lokal tanpa memanggil Google Places API.
   - Pertahankan validasi whitelist `isAllowedReviewUrl()` di sisi server (`POST /api/admin/codes`) dan saat redirect publik (`GET /c/[code]`).
3. **Mode Tes Redirect (`?preview=1`)**:
   - Di `app/c/[code]/route.ts`, periksa `req.nextUrl.searchParams.get("preview") === "1"`.
   - Verifikasi `await isAdminLoggedIn()` sebelum melewati pencatatan tap (`incrementTapCount` dan `addTapLog`).
   - Pastikan tombol "Tes Link" di admin mengarah ke `/c/<code>?preview=1`.
4. **Reset Tap Otomatis Saat Pindah Toko/Target**:
   - Jika `googleReviewUrl` berubah saat edit kartu yang sudah ada, tampilkan indikator jelas di UI dan biarkan API mereset hitungan tap dan log kode tersebut ke `0`.
5. **Konsistensi Analitik**:
   - Saring log tap hanya untuk kode yang masih ada di daftar kartu aktif (`activeCodesSet`) agar kartu yang sudah dihapus tidak pernah muncul kembali di dashboard maupun analitik.

## Verifikasi

1. Pastikan tidak ada pemanggilan API berbayar eksternal.
2. Cek seluruh endpoint admin masih memanggil `isAdminLoggedIn()`.
3. Jalankan `npx tsc --noEmit` dan `npm run build`.
