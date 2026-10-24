// Hanya izinkan redirect ke domain Google. Ini SATU-SATUNYA tempat yang
// menentukan "boleh/tidak" suatu URL dipakai sebagai tujuan redirect.
// Dipakai di DUA tempat: saat admin menyimpan data, dan saat redirect
// benar-benar dieksekusi (safety net kedua, jangan dihapus salah satunya).

const ALLOWED_HOSTS = [
  "search.google.com",
  "www.google.com",
  "google.com",
  "g.page",
  "maps.app.goo.gl",
  "maps.google.com",
  "goo.gl",
];

export function isAllowedReviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Mengubah URL tujuan Google Review (yang defaultnya langsung memunculkan pop-up dialog rating)
 * menjadi halaman ulasan publik di depan, agar admin dapat melihat menu dan daftar ulasan pelanggan.
 *
 * Contoh transformasi:
 * - https://search.google.com/local/writereview?placeid=... -> https://search.google.com/local/reviews?placeid=...
 * - https://g.page/r/XXXXX/review -> https://g.page/r/XXXXX
 * - https://g.page/namatoko/review/ -> https://g.page/namatoko
 * - Query param writereview=1 dibersihkan
 */
export function getPublicGoogleReviewUrl(url?: string): string {
  if (!url) return "";
  let clean = url.trim();

  // 1. Ubah /local/writereview -> /local/reviews
  clean = clean.replace(/\/local\/writereview/gi, "/local/reviews");

  // 2. Hapus /review atau /review/ di akhir path (sebelum query string, hash, atau akhir URL)
  clean = clean.replace(/\/review(\/)?(?=[?#]|$)/gi, "");

  // 3. Bersihkan query param writereview jika ada
  clean = clean.replace(/([?&])writereview(=[^&#]*)?(&|$)/gi, (match, p1, p2, p3) => {
    return p3 === "&" ? p1 : "";
  });

  // 4. Bersihkan trailing ? atau &
  clean = clean.replace(/[?&]$/, "");

  // 5. Normalisasi jika query string diawali dengan &
  if (clean.includes("&") && !clean.includes("?")) {
    clean = clean.replace("&", "?");
  }

  return clean;
}

