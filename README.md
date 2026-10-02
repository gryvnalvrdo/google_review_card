# Google Review Card

Sistem redirect untuk kartu NFC/QR "Tap to Review". Lihat `CLAUDE.md` untuk
penjelasan lengkap alur, keputusan desain, dan keamanan.

## Jalan cepat (lokal, mode testing tanpa database)

```bash
npm install
cp .env.example .env.local
# isi ADMIN_PASSWORD dan SESSION_SECRET di .env.local
npm run dev
```

Buka `http://localhost:3000/admin`, login, assign kode -> toko, lalu buka
`http://localhost:3000/c/<kode>` untuk coba redirect-nya.
(Tanpa Vercel KV terkoneksi, data disimpan sementara di memory — hilang tiap
restart. Cukup untuk testing alur, tidak untuk produksi.)

## Deploy ke Vercel (produksi)

1. Push repo ini ke GitHub (lihat instruksi di bawah).
2. Buka [vercel.com](https://vercel.com) -> Add New Project -> Import dari
   GitHub -> pilih repo ini.
3. Di project Vercel: tab **Storage** -> Create Database -> pilih **KV** ->
   connect ke project ini (env var `KV_REST_API_URL` & `KV_REST_API_TOKEN`
   otomatis terisi).
4. Di tab **Settings -> Environment Variables**, tambahkan manual:
   - `ADMIN_PASSWORD` — password untuk login admin
   - `SESSION_SECRET` — string acak panjang (bisa generate dari
     `openssl rand -hex 32` di terminal)
5. Klik **Deploy**.

## Generate kode kartu baru

```bash
node scripts/generate-codes.mjs 20 nama-project-kamu.vercel.app
```

Lihat `CLAUDE.md` bagian "Cara generate kode kartu baru" untuk langkah
selanjutnya (QR code, cetak kartu, tulis NFC).

## Push repo ini ke GitHub

Dari folder project:

```bash
git add .
git commit -m "Initial commit: google review card redirect system"
git branch -M main
git remote add origin https://github.com/gryvnalvrdo/google_review_card.git
git push -u origin main
```
