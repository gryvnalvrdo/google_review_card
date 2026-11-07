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
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
];

export function isInstagramUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "instagr.am" ||
      host.endsWith(".instagr.am")
    );
  } catch {
    return false;
  }
}

export function extractInstagramUsername(urlOrUsername?: string): string {
  if (!urlOrUsername) return "";
  let clean = urlOrUsername.trim().replace(/^@+/, "");
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const parsed = new URL(clean);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length > 0 && !["p", "reel", "stories", "tv", "explore"].includes(segments[0].toLowerCase())) {
        return segments[0];
      }
    } catch {}
  }
  // Bare username handling: bersihkan nama domain jika ada
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "");
  clean = clean.split("/")[0].split("?")[0].trim();
  return clean;
}

export function formatInstagramUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  // Jika sudah URL Instagram lengkap untuk post/reel spesifik
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (isInstagramUrl(raw)) {
        const pathname = parsed.pathname.replace(/\/+$/, "");
        return `https://www.instagram.com${pathname}/`;
      }
    } catch {}
  }

  const username = extractInstagramUsername(raw);
  if (!username) return "";
  return `https://www.instagram.com/${username}/`;
}

export function getTargetType(url?: string): "google" | "instagram" {
  return isInstagramUrl(url) ? "instagram" : "google";
}

export function getInstagramDeepLinks(urlOrUsername: string): {
  username: string;
  webUrl: string;
  iosUrl: string;
  androidIntent: string;
} {
  const clean = (urlOrUsername || "").trim();
  const username = extractInstagramUsername(clean);
  const webUrl = formatInstagramUrl(clean);

  // Jika URL mengarah ke post atau reel spesifik
  const isPostOrReel = clean.includes("/p/") || clean.includes("/reel/");
  if (isPostOrReel) {
    try {
      const parsed = new URL(clean);
      const pathname = parsed.pathname.replace(/^\/|\/$/g, ""); // cth: "p/Cxyz123" atau "reel/Cxyz123"
      return {
        username: "",
        webUrl,
        iosUrl: `instagram://${pathname}`,
        androidIntent: `intent://instagram.com/${pathname}/#Intent;package=com.instagram.android;scheme=https;end;`,
      };
    } catch {}
  }

  return {
    username,
    webUrl,
    iosUrl: username ? `instagram://user?username=${encodeURIComponent(username)}` : "instagram://app",
    androidIntent: username
      ? `intent://instagram.com/_u/${encodeURIComponent(username)}/#Intent;package=com.instagram.android;scheme=https;end;`
      : "intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end;",
  };
}

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
      host.endsWith(".g.co") ||
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "instagr.am" ||
      host.endsWith(".instagr.am")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getPublicGoogleReviewUrl(url?: string, storeName?: string): string {
  if (url && isInstagramUrl(url)) {
    return formatInstagramUrl(url);
  }

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
