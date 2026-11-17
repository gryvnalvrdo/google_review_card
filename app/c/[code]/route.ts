import { NextRequest, NextResponse } from "next/server";
import { getCard, incrementTapCount, addTapLog } from "../../../lib/kv";
import { isAdminLoggedIn } from "../../../lib/auth";
import { isAllowedReviewUrl, isInstagramUrl, getInstagramDeepLinks } from "../../../lib/redirect";

const NOT_ACTIVE_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Kartu Belum Aktif</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #0B0D12;
        color: #E6EAF2;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .card {
        background: #12151E;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 32px 24px;
        text-align: center;
        max-width: 380px;
        width: 100%;
      }
      .icon {
        width: 48px;
        height: 48px;
        background: rgba(244, 63, 94, 0.12);
        border: 1px solid rgba(244, 63, 94, 0.25);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 18px;
        color: #FB7185;
      }
      h1 { font-size: 1.15rem; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.01em; }
      p { color: #9BA3B4; font-size: 0.875rem; line-height: 1.6; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 20px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 9999px;
        font-size: 0.75rem;
        color: #9BA3B4;
        font-weight: 500;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h1>Kartu Belum Aktif</h1>
      <p>Kartu ini belum terhubung ke toko manapun. Hubungi penyedia kartu Anda untuk mengaktifkannya.</p>
      <div class="pill">Belum terdaftar di sistem</div>
    </div>
  </body>
</html>`;

function retryHtml(code: string) {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Menghubungkan...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="2;url=/c/${encodeURIComponent(code)}" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #0B0D12;
        color: #E6EAF2;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .card {
        background: #12151E;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 32px 24px;
        text-align: center;
        max-width: 380px;
        width: 100%;
      }
      .spinner {
        width: 36px;
        height: 36px;
        border: 2.5px solid rgba(99, 102, 241, 0.2);
        border-top-color: #818CF8;
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
        margin: 0 auto 18px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      h1 { font-size: 1.15rem; font-weight: 700; margin-bottom: 8px; }
      p { color: #9BA3B4; font-size: 0.875rem; line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <h1>Menghubungkan...</h1>
      <p>Sedang menyambungkan ke halaman toko. Halaman akan dialihkan otomatis dalam beberapa detik.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function isLikelyPrefetchOrBot(req: NextRequest): boolean {
  if (req.method === "HEAD") return true;
  const purpose = (
    req.headers.get("purpose") ||
    req.headers.get("sec-purpose") ||
    req.headers.get("x-purpose") ||
    req.headers.get("x-moz") ||
    ""
  ).toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("preview") || purpose.includes("prerender")) {
    return true;
  }
  const ua = req.headers.get("user-agent") || "";
  if (!ua) return true;
  return /WhatsApp|TelegramBot|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|Googlebot|bingbot|Applebot|HeadlessChrome|curl\/|Wget\/|python-requests/i.test(
    ua
  );
}

function instagramBridgeHtml(
  storeName: string,
  deepLinks: { username: string; webUrl: string; iosUrl: string; androidIntent: string },
  isPreview: boolean
) {
  const displayTitle = escapeHtml(storeName || (deepLinks.username ? `@${deepLinks.username}` : "Instagram"));
  const handleText = deepLinks.username ? `@${escapeHtml(deepLinks.username)}` : "";

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>${displayTitle} (Instagram)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #0B0D12;
        color: #E6EAF2;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .card {
        background: #12151E;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 28px 24px;
        text-align: center;
        max-width: 390px;
        width: 100%;
      }
      .preview-tag {
        display: inline-block;
        margin-bottom: 16px;
        padding: 4px 10px;
        border-radius: 9999px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #FBBF24;
        font-size: 0.72rem;
        font-weight: 600;
      }
      .icon-wrap {
        width: 56px;
        height: 56px;
        margin: 0 auto 16px;
        border-radius: 14px;
        background: rgba(244, 63, 94, 0.12);
        border: 1px solid rgba(244, 63, 94, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FB7185;
      }
      h1 { font-size: 1.2rem; font-weight: 700; margin-bottom: 4px; color: #E6EAF2; }
      .handle {
        color: #FB7185;
        font-weight: 600;
        font-size: 0.875rem;
        margin-bottom: 14px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      p { color: #9BA3B4; font-size: 0.85rem; line-height: 1.6; margin-bottom: 20px; }
      .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        padding: 12px 18px;
        background: #E11D48;
        color: #FFFFFF;
        font-weight: 600;
        font-size: 0.9rem;
        border-radius: 10px;
        text-decoration: none;
        transition: background-color 0.15s ease;
      }
      .btn-primary:hover { background: #BE123C; }
      .btn-secondary {
        display: inline-block;
        margin-top: 14px;
        color: #9BA3B4;
        font-size: 0.8rem;
        text-decoration: none;
        padding: 6px 10px;
      }
      .btn-secondary:hover { color: #E6EAF2; }
    </style>
  </head>
  <body>
    <div class="card">
      ${isPreview ? `<div class="preview-tag">Mode Tes Admin: Tap tidak dicatat</div>` : ""}
      <div class="icon-wrap">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
        </svg>
      </div>
      <h1>${displayTitle}</h1>
      ${handleText ? `<div class="handle">${handleText}</div>` : ""}
      <p>Ketuk tombol di bawah untuk membuka profil toko langsung di aplikasi Instagram.</p>
      <a id="app-btn" class="btn-primary" href="${escapeHtml(deepLinks.androidIntent)}">
        <span>Buka Aplikasi Instagram</span>
      </a>
      <div>
        <a id="web-fallback-link" class="btn-secondary" href="${escapeHtml(deepLinks.webUrl)}">
          Buka di browser web
        </a>
      </div>
    </div>
    <script>
      (function() {
        var userAgent = navigator.userAgent || navigator.vendor || window.opera || "";
        var isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        var iosUrl = ${safeJsonForScript(deepLinks.iosUrl)};
        var androidIntent = ${safeJsonForScript(deepLinks.androidIntent)};
        var targetDeepLink = isIOS ? iosUrl : androidIntent;
        var appBtn = document.getElementById("app-btn");
        if (appBtn) {
          appBtn.href = targetDeepLink;
        }
        try {
          window.location.href = targetDeepLink;
        } catch (e) {}
        document.body.addEventListener("click", function(e) {
          if (e.target && (e.target.id === "web-fallback-link" || e.target.closest("#web-fallback-link"))) {
            return;
          }
          window.location.href = targetDeepLink;
        });
      })();
    </script>
  </body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const rawCode = params?.code || "";
  const code = rawCode.trim();
  const wantsPreview = req.nextUrl.searchParams.get("preview") === "1";

  if (!/^[a-zA-Z0-9_-]{1,20}$/.test(code) || code.toLowerCase() === "_index") {
    return new NextResponse(NOT_ACTIVE_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  let card = null;

  try {
    card = await getCard(code);
    if (!card && code) {
      if (code !== code.toLowerCase()) {
        card = await getCard(code.toLowerCase());
      }
      if (!card && code !== code.toUpperCase()) {
        card = await getCard(code.toUpperCase());
      }
    }
  } catch (err) {
    console.error("KV connection error on tap code=" + code, err);
    return new NextResponse(retryHtml(code), {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Retry-After": "2",
      },
    });
  }

  if (!card) {
    return new NextResponse(NOT_ACTIVE_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  let targetUrl = card.googleReviewUrl?.trim();
  if (!targetUrl || !isAllowedReviewUrl(targetUrl)) {
    if (card.storeName && card.storeName.trim()) {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(card.storeName.trim())}+ulasan`;
    } else {
      return new NextResponse(NOT_ACTIVE_HTML, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }
  }

  const isPreview = wantsPreview ? await isAdminLoggedIn().catch(() => false) : false;
  const skipTracking = isPreview || isLikelyPrefetchOrBot(req);

  if (!skipTracking) {
    Promise.allSettled([
      incrementTapCount(card.code || code),
      addTapLog({
        code: card.code || code,
        storeName: card.storeName,
        tappedAt: new Date().toISOString(),
      }),
    ]).catch(() => {});
  }

  if (isInstagramUrl(targetUrl)) {
    const userAgent = req.headers.get("user-agent") || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (isMobile) {
      const deepLinks = getInstagramDeepLinks(targetUrl);
      return new NextResponse(instagramBridgeHtml(card.storeName, deepLinks, isPreview), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          ...(isPreview ? { "X-ReviewCard-Preview": "1" } : {}),
        },
      });
    }
  }

  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      ...(isPreview ? { "X-ReviewCard-Preview": "1" } : {}),
    },
  });
}
