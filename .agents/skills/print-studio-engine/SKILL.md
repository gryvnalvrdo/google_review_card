---
name: print-studio-engine
description: >-
  Gunakan skill ini saat memodifikasi fitur studio desain dan cetak batch QR
  di /admin/print termasuk deteksi dummy QR, rendering canvas HD, dan ekspor ZIP.
---

# Print Studio Engine Skill

Skill ini menjaga kualitas output cetak fisik dan performa browser saat merender hingga 200 kartu QR beresolusi tinggi.

## Prinsip Teknis Print Studio

1. **Pisahkan Pure Canvas Logic dari JSX**:
   - Fungsi pemrosesan gambar (`enhanceBackgroundImage`, `detectBoxInImage`, `eraseDummyQRCodeFromImage`, `centerQRInSlot`, `renderStyledQR`, `compositeCard`) ditempatkan di modul terpisah (`app/admin/print/_lib/`) agar UI studio tetap bersih dan mudah dirawat.
2. **Ketajaman Cetak Fisik**:
   - Modul QR harus dibulatkan ke piksel utuh (`Math.floor(size / count)`) agar tidak muncul anti-aliasing kabur saat dicetak pada kartu PVC atau stiker meja.
   - Pertahankan error correction level `H` terutama ketika logo tengah (`google`, `star`, `nfc`) diaktifkan.
3. **Alur Auto-Save Kode Sementara (90 Hari)**:
   - Saat ekspor PNG tunggal, multi-PNG, atau ZIP selesai, simpan kode yang berhasil dicetak ke `/api/admin/stock` (`stok:_timed`) di background agar langsung tersedia di pemilih cepat form Hubungkan Kartu dan otomatis terhapus setelah 90 hari bila belum digunakan.
4. **Ruang Lingkup Terfokus**:
   - Jangan menambahkan kompleksitas fitur simpan preset desain ke database kecuali diminta secara eksplisit; pertahankan pengaturan sesi aktif yang cepat dan ringan.

## Verifikasi

1. Uji kompilasi TypeScript pada modul canvas (`npx tsc --noEmit`).
2. Pastikan `@media print` atau style khusus kanvas tidak merusak layout halaman admin lainnya.
3. Jalankan `npm run build`.
