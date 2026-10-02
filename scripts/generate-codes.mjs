#!/usr/bin/env node
// Generate N kode kartu acak + URL lengkapnya, siap dijadikan QR code
// dan ditulis ke chip NFC. Kode TIDAK otomatis masuk ke database —
// baru benar-benar aktif saat di-assign lewat halaman /admin.
//
// Pakai: node scripts/generate-codes.mjs 20 [domain]
// Contoh: node scripts/generate-codes.mjs 20 review-card.vercel.app

import crypto from "crypto";

const count = Number(process.argv[2] ?? 10);
const domain = process.argv[3] ?? "<isi-domain-vercel-kamu>";

function randomCode(length = 6) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // hindari huruf/angka ambigu
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

console.log(`Generating ${count} kode kartu...\n`);
const seen = new Set();
let i = 0;
while (i < count) {
  const code = randomCode();
  if (seen.has(code)) continue;
  seen.add(code);
  i++;
  console.log(`${i}. ${code}  ->  https://${domain}/c/${code}`);
}
console.log(
  "\nLangkah selanjutnya:\n" +
    "1. Buat QR code dari tiap URL di atas (generator QR apa saja).\n" +
    "2. Tempel QR ke desain kartu, lalu cetak massal.\n" +
    "3. Tulis URL yang sama ke chip NFC tiap kartu (app NFC Tools -> Write -> URL).\n" +
    "4. Saat toko deal, buka /admin dan assign kode kartu ini ke toko tersebut."
);
