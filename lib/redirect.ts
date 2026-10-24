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

export function getPublicGoogleReviewUrl(url?: string, storeName?: string): string {
  if (storeName && storeName.trim()) {
    const trimmed = storeName.trim();
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  if (!url) return "";
  let clean = url.trim();

  const gPageMatch = clean.match(/g\.page\/([^/?#]+)/i);
  if (gPageMatch && gPageMatch[1] && gPageMatch[1].toLowerCase() !== "r") {
    const slug = decodeURIComponent(gPageMatch[1]).replace(/[-_]/g, " ");
    return `https://www.google.com/search?q=${encodeURIComponent(slug)}`;
  }

  const matchPlaceId = clean.match(/placeid=([a-zA-Z0-9_\-]+)/i);
  if (matchPlaceId && matchPlaceId[1]) {
    return `https://www.google.com/search?q=${encodeURIComponent("place_id:" + matchPlaceId[1])}`;
  }

  clean = clean.replace(/\/local\/writereview/gi, "/local/reviews");
  clean = clean.replace(/\/writereview/gi, "");
  clean = clean.replace(/([?&])writereview(=[^&#]*)?(&|$)/gi, (_, p1, _p2, p3) => {
    return p3 === "&" ? p1 : "";
  });
  clean = clean.replace(/[?&]$/, "");

  return clean;
}
