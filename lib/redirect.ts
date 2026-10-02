// Hanya izinkan redirect ke domain Google. Ini SATU-SATUNYA tempat yang
// menentukan "boleh/tidak" suatu URL dipakai sebagai tujuan redirect.
// Dipakai di DUA tempat: saat admin menyimpan data, dan saat redirect
// benar-benar dieksekusi (safety net kedua, jangan dihapus salah satunya).

const ALLOWED_HOSTS = ["search.google.com", "www.google.com", "google.com"];

export function isAllowedReviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
