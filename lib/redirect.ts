const ALLOWED_GOOGLE_HOSTS = new Set([
  "search.google.com",
  "maps.google.com",
  "maps.google.co.id",
  "www.google.com",
  "google.com",
  "www.google.co.id",
  "google.co.id",
  "g.page",
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
]);

const ALLOWED_INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "instagr.am",
]);

export type GoogleInputParseResult = {
  kind: "empty" | "placeid" | "url" | "invalid";
  placeId?: string;
  reviewUrl: string;
  suggestedStoreName?: string;
  error?: string;
};

export function isInstagramUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (parsed.username || parsed.password) return false;
    return ALLOWED_INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase());
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
        return segments[0].replace(/[^a-zA-Z0-9._]/g, "");
      }
    } catch {}
  }
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i, "");
  clean = clean.split("/")[0].split("?")[0].replace(/[^a-zA-Z0-9._]/g, "").trim();
  return clean;
}

export function formatInstagramUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (isInstagramUrl(raw)) {
        const pathname = parsed.pathname.replace(/\/+$/, "").replace(/[<>"'\\]/g, "");
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

  const isPostOrReel = clean.includes("/p/") || clean.includes("/reel/");
  if (isPostOrReel) {
    try {
      const parsed = new URL(clean);
      const pathname = parsed.pathname.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9/_-]/g, "");
      if (pathname) {
        return {
          username: "",
          webUrl,
          iosUrl: `instagram://${pathname}`,
          androidIntent: `intent://www.instagram.com/${pathname}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end;`,
        };
      }
    } catch {}
  }

  return {
    username,
    webUrl,
    iosUrl: username ? `instagram://user?username=${encodeURIComponent(username)}` : "instagram://app",
    androidIntent: username
      ? `intent://www.instagram.com/${encodeURIComponent(username)}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end;`
      : `intent://www.instagram.com/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end;`,
  };
}

export function isAllowedReviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (ALLOWED_INSTAGRAM_HOSTS.has(host)) {
      return true;
    }

    if (ALLOWED_GOOGLE_HOSTS.has(host)) {
      if ((host.includes("google.") || host === "goo.gl") && (path === "/url" || path.startsWith("/url/"))) {
        return false;
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function parseGoogleMapsOrPlaceId(rawInput: string): GoogleInputParseResult {
  const raw = (rawInput || "").trim();
  if (!raw) {
    return { kind: "empty", reviewUrl: "" };
  }

  const placeIdParamMatch = raw.match(/[?&]placeid=([a-zA-Z0-9_-]+)/i);
  if (placeIdParamMatch?.[1]) {
    const placeId = placeIdParamMatch[1];
    return {
      kind: "placeid",
      placeId,
      reviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
    };
  }

  const looksLikeUrl =
    /^https?:\/\//i.test(raw) ||
    /^(?:www\.)?(?:google\.|g\.page|maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.)/i.test(raw);

  if (looksLikeUrl) {
    const candidateUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const chijMatch = candidateUrl.match(/(ChIJ[a-zA-Z0-9_-]{10,})/);
    const placeNameMatch = candidateUrl.match(/\/maps\/place\/([^/@?#]+)/i);
    const suggestedStoreName = placeNameMatch?.[1]
      ? decodeURIComponent(placeNameMatch[1]).replace(/\+/g, " ").trim()
      : undefined;

    if (chijMatch?.[1]) {
      return {
        kind: "placeid",
        placeId: chijMatch[1],
        reviewUrl: `https://search.google.com/local/writereview?placeid=${chijMatch[1]}`,
        suggestedStoreName,
      };
    }

    if (isAllowedReviewUrl(candidateUrl) && !isInstagramUrl(candidateUrl)) {
      return {
        kind: "url",
        reviewUrl: candidateUrl,
        suggestedStoreName,
      };
    }

    return {
      kind: "invalid",
      reviewUrl: "",
      error: "Link harus berasal dari domain resmi Google Review atau Google Maps.",
    };
  }

  if (/^[a-zA-Z0-9_-]{6,120}$/.test(raw)) {
    return {
      kind: "placeid",
      placeId: raw,
      reviewUrl: `https://search.google.com/local/writereview?placeid=${raw}`,
    };
  }

  return {
    kind: "invalid",
    reviewUrl: "",
    error: "Masukkan Google Place ID yang valid atau tempel tautan resmi Google Maps.",
  };
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
