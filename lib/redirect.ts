const ALLOWED_HOSTS = [
  "search.google.com",
  "www.google.com",
  "google.com",
  "g.page",
  "maps.app.goo.gl",
  "maps.google.com",
  "goo.gl",
  "g.co",
  "google.co.id",
  "www.google.co.id",
  "maps.google.co.id",
];

export function isAllowedReviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_HOSTS.includes(host)) return true;
    if (
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "google.co.id" ||
      host.endsWith(".google.co.id") ||
      host === "goo.gl" ||
      host.endsWith(".goo.gl") ||
      host === "g.page" ||
      host.endsWith(".g.page") ||
      host === "g.co" ||
      host.endsWith(".g.co")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getPublicGoogleReviewUrl(url?: string, storeName?: string): string {
  if (!url && storeName && storeName.trim()) {
    return `https://www.google.com/search?q=${encodeURIComponent(storeName.trim())}`;
  }

  if (!url) return "";
  let clean = url.trim();

  const matchPlaceId = clean.match(/placeid=([a-zA-Z0-9_\-]+)/i);
  if (matchPlaceId && matchPlaceId[1]) {
    return `https://search.google.com/local/reviews?placeid=${matchPlaceId[1]}`;
  }

  const gPageMatch = clean.match(/g\.page\/([^/?#]+)/i);
  if (gPageMatch && gPageMatch[1] && gPageMatch[1].toLowerCase() !== "r") {
    const slug = decodeURIComponent(gPageMatch[1]).replace(/[-_]/g, " ");
    return `https://www.google.com/search?q=${encodeURIComponent(slug)}`;
  }

  clean = clean.replace(/\/local\/writereview/gi, "/local/reviews");
  clean = clean.replace(/\/writereview/gi, "");
  clean = clean.replace(/([?&])writereview(=[^&#]*)?(&|$)/gi, (_, p1, _p2, p3) => {
    return p3 === "&" ? p1 : "";
  });
  clean = clean.replace(/[?&]$/, "");

  if (!clean && storeName && storeName.trim()) {
    return `https://www.google.com/search?q=${encodeURIComponent(storeName.trim())}`;
  }

  return clean || url;
}
