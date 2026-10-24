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
 * Mengubah URL tujuan Google Review (yang defaultnya langsung memunculkan pop-up formulir rating bintang)
 * menjadi halaman awal profil toko di Google Maps ("halaman awalnya aja"),
 * agar admin dapat melihat menu, informasi umum, dan daftar ulasan pelanggan tanpa terhalang pop-up rating.
 *
 * Contoh transformasi:
 * - https://search.google.com/local/writereview?placeid=ChIJ... -> https://www.google.com/maps/place/?q=place_id:ChIJ...
 * - https://search.google.com/local/reviews?placeid=ChIJ... -> https://www.google.com/maps/place/?q=place_id:ChIJ...
 * - https://g.page/r/XXXXX/review -> https://g.page/r/XXXXX
 * - https://g.page/namatoko/review/ -> https://g.page/namatoko
 * - Query param writereview dibersihkan
 */
export function getPublicGoogleReviewUrl(url?: string): string {
  if (!url) return "";
  let clean = url.trim();

  // 1. Ekstrak placeid jika ada di URL (misal: search.google.com/local/writereview?placeid=ChIJ... atau local/reviews?placeid=...):
  // Konversi LANGSUNG ke URL Google Maps place resmi! Ini membuka halaman awal profil toko secara bersih
  // tanpa memunculkan form / dialog pop-up rating bintang sama sekali.
  const matchPlaceId = clean.match(/placeid=([a-zA-Z0-9_\-]+)/i);
  if (matchPlaceId && matchPlaceId[1]) {
    return `https://www.google.com/maps/place/?q=place_id:${matchPlaceId[1]}`;
  }

  // 2. Jika merupakan link g.page (misal: https://g.page/r/XXXXX/review atau https://g.page/tokoname/review):
  // Hapus '/review' agar otomatis redirect ke halaman awal profil toko di Google Maps
  clean = clean.replace(/\/review(\/)?(?=[?#]|$)/gi, "");

  // 3. Ubah /local/writereview -> /local/reviews jika tidak ada placeid
  clean = clean.replace(/\/local\/writereview/gi, "/local/reviews");

  // 4. Bersihkan query param writereview jika ada (?writereview=1 dsb)
  clean = clean.replace(/([?&])writereview(=[^&#]*)?(&|$)/gi, (match, p1, p2, p3) => {
    return p3 === "&" ? p1 : "";
  });

  // 5. Bersihkan trailing ? atau &
  clean = clean.replace(/[?&]$/, "");

  // 6. Normalisasi jika query string diawali dengan &
  if (clean.includes("&") && !clean.includes("?")) {
    clean = clean.replace("&", "?");
  }

  return clean;
}

