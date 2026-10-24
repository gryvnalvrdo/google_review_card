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
 * Mengubah link review menjadi URL ulasan publik di Google Search (BUKAN Google Maps).
 *
 * Mengapa Google Search dan BUKAN Google Maps?
 * Pada smartphone (Android & iPhone), link ke `google.com/maps` otomatis membuka aplikasi Google Maps bawaan.
 * Aplikasi Google Maps mobile TIDAK mengenali query format `place_id:` melalui deep link,
 * sehingga sering memunculkan error "Hasil tidak ditemukan" / kosong di mobile.
 *
 * Dengan mengarahkan ke Google Search (`www.google.com/search?q=...`):
 * 1. Selalu terbuka di browser (Chrome / Safari), BUKAN membuka aplikasi Google Maps.
 * 2. Menampilkan Google Knowledge Panel resmi toko beserta rating bintang dan tab ulasan pelanggan.
 * 3. Tidak memunculkan dialog pop-up "Tulis ulasan bintang 5" (yang mengganggu jika admin hanya ingin memantau).
 */
export function getPublicGoogleReviewUrl(url?: string, storeName?: string): string {
  // 1. Jika nama toko tersedia, gunakan Google Search dengan query "[Nama Toko] ulasan"
  if (storeName && storeName.trim()) {
    const trimmed = storeName.trim();
    const query = /ulasan|review/i.test(trimmed) ? trimmed : `${trimmed} ulasan`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  if (!url) return "";
  let clean = url.trim();

  // 2. Jika ada link g.page dengan nama toko (misal: https://g.page/tokoberkah/review)
  const gPageMatch = clean.match(/g\.page\/([^/?#]+)/i);
  if (gPageMatch && gPageMatch[1] && gPageMatch[1].toLowerCase() !== "r") {
    const slug = decodeURIComponent(gPageMatch[1]).replace(/[-_]/g, " ");
    return `https://www.google.com/search?q=${encodeURIComponent(slug + " ulasan")}`;
  }

  // 3. Jika ada placeid di URL tapi tidak ada nama toko
  const matchPlaceId = clean.match(/placeid=([a-zA-Z0-9_\-]+)/i);
  if (matchPlaceId && matchPlaceId[1]) {
    return `https://www.google.com/search?q=${encodeURIComponent("ulasan google place_id:" + matchPlaceId[1])}`;
  }

  // Fallback: bersihkan query param writereview
  clean = clean.replace(/\/local\/writereview/gi, "/local/reviews");
  clean = clean.replace(/\/writereview/gi, "");
  clean = clean.replace(/([?&])writereview(=[^&#]*)?(&|$)/gi, (match, p1, p2, p3) => {
    return p3 === "&" ? p1 : "";
  });
  clean = clean.replace(/[?&]$/, "");

  return clean;
}

