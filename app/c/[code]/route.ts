import { NextRequest, NextResponse } from "next/server";
import { getCard, incrementTapCount, addTapLog } from "../../../lib/kv";
import { isAllowedReviewUrl, isInstagramUrl, getInstagramDeepLinks } from "../../../lib/redirect";

// HTML halaman "Kartu Belum Aktif" (kartu memang belum terdaftar / tidak valid)
const NOT_ACTIVE_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Kartu Belum Aktif</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', system-ui, sans-serif;
        background: #0A0A0F;
        color: #F0F0FF;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        overflow: hidden;
      }
      .blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.12; pointer-events: none; }
      .blob-1 { width: 400px; height: 400px; background: #4F46E5; top: -120px; left: -80px; }
      .blob-2 { width: 350px; height: 350px; background: #8B5CF6; bottom: -80px; right: -60px; }
      .card {
        background: #111118;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        padding: 40px 32px;
        text-align: center;
        max-width: 380px;
        width: 100%;
        position: relative;
        z-index: 1;
        box-shadow: 0 4px 40px rgba(0,0,0,0.5);
      }
      .icon {
        width: 64px; height: 64px;
        background: rgba(239,68,68,0.15);
        border: 1px solid rgba(239,68,68,0.3);
        border-radius: 18px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.8rem;
        margin: 0 auto 20px;
      }
      h1 { font-size: 1.3rem; font-weight: 700; margin-bottom: 12px; }
      p { color: #9A9AB0; font-size: 0.9rem; line-height: 1.7; }
      .badge {
        display: inline-block;
        margin-top: 20px;
        padding: 6px 16px;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.25);
        border-radius: 999px;
        font-size: 0.75rem;
        color: #FCA5A5;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="card">
      <div class="icon">🔒</div>
      <h1>Kartu Belum Aktif</h1>
      <p>Kartu ini belum terhubung ke toko manapun.<br>Hubungi penyedia kartu Anda untuk mengaktifkannya.</p>
      <div class="badge">⚠️ Tidak ada toko terdaftar</div>
    </div>
  </body>
</html>`;

// HTML halaman "Menghubungkan..." — tampil saat terjadi error koneksi sementara ke KV.
// Auto-refresh setelah 2 detik agar pelanggan tidak perlu tap ulang.
function retryHtml(code: string) {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Menghubungkan...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="2;url=/c/${code}" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', system-ui, sans-serif;
        background: #0A0A0F;
        color: #F0F0FF;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        overflow: hidden;
      }
      .blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.12; pointer-events: none; }
      .blob-1 { width: 400px; height: 400px; background: #4F46E5; top: -120px; left: -80px; }
      .blob-2 { width: 350px; height: 350px; background: #8B5CF6; bottom: -80px; right: -60px; }
      .card {
        background: #111118;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        padding: 40px 32px;
        text-align: center;
        max-width: 380px;
        width: 100%;
        position: relative;
        z-index: 1;
        box-shadow: 0 4px 40px rgba(0,0,0,0.5);
      }
      .spinner {
        width: 48px; height: 48px;
        border: 3px solid rgba(99,102,241,0.2);
        border-top-color: #818CF8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      h1 { font-size: 1.2rem; font-weight: 700; margin-bottom: 10px; }
      p { color: #9A9AB0; font-size: 0.88rem; line-height: 1.7; }
      .badge {
        display: inline-block;
        margin-top: 20px;
        padding: 6px 16px;
        background: rgba(99,102,241,0.1);
        border: 1px solid rgba(99,102,241,0.3);
        border-radius: 999px;
        font-size: 0.75rem;
        color: #A5B4FC;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="card">
      <div class="spinner"></div>
      <h1>Menghubungkan...</h1>
      <p>Sedang menghubungkan ke server toko.<br>Halaman akan otomatis dialihkan dalam 2 detik.</p>
      <div class="badge">⏳ Mengalihkan otomatis...</div>
    </div>
  </body>
</html>`;
}

// HTML Halaman Jembatan Deep Link Instagram (Khusus Mobile: iOS & Android).
// Otomatis memicu URL Scheme / Intent agar aplikasi Instagram terbuka langsung.
function instagramBridgeHtml(storeName: string, deepLinks: { username: string; webUrl: string; iosUrl: string; androidIntent: string }) {
  const displayTitle = storeName || (deepLinks.username ? `@${deepLinks.username}` : "Instagram");
  const handleText = deepLinks.username ? `@${deepLinks.username}` : "";

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Membuka ${displayTitle} di Instagram...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #0A0A0F;
        color: #F0F0FF;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        overflow: hidden;
      }
      .blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.18; pointer-events: none; }
      .blob-1 { width: 380px; height: 380px; background: #E1306C; top: -100px; left: -80px; }
      .blob-2 { width: 360px; height: 360px; background: #833AB4; bottom: -80px; right: -60px; }
      .card {
        background: rgba(18, 18, 26, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 36px 28px;
        text-align: center;
        max-width: 390px;
        width: 100%;
        position: relative;
        z-index: 1;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(225, 48, 108, 0.15);
        backdrop-filter: blur(12px);
      }
      .ig-icon-wrap {
        width: 72px;
        height: 72px;
        margin: 0 auto 18px;
        border-radius: 20px;
        background: linear-gradient(45deg, #F58529, #FEDA77, #DD2A7B, #8134AF, #515BD4);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 24px rgba(221, 42, 123, 0.35);
      }
      .ig-icon-inner {
        width: 64px;
        height: 64px;
        border-radius: 17px;
        background: #111118;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ig-icon {
        width: 36px;
        height: 36px;
        fill: #FFFFFF;
      }
      h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 6px; color: #FFFFFF; }
      .handle {
        color: #F472B6;
        font-weight: 700;
        font-size: 0.9rem;
        margin-bottom: 16px;
        font-family: monospace;
      }
      p { color: #9A9AB0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 22px; }
      .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 20px;
        background: linear-gradient(135deg, #E1306C, #C13584, #833AB4);
        color: #FFFFFF;
        font-weight: 800;
        font-size: 0.95rem;
        border-radius: 14px;
        text-decoration: none;
        box-shadow: 0 4px 20px rgba(225, 48, 108, 0.4);
        transition: transform 0.15s ease;
      }
      .btn-primary:active { transform: scale(0.98); }
      .btn-secondary {
        display: inline-block;
        margin-top: 14px;
        color: #A5B4FC;
        font-size: 0.78rem;
        text-decoration: none;
        padding: 6px 12px;
      }
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #FFFFFF;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="card">
      <div class="ig-icon-wrap">
        <div class="ig-icon-inner">
          <svg class="ig-icon" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
      </div>
      <h1>${displayTitle}</h1>
      ${handleText ? `<div class="handle">${handleText}</div>` : ""}
      <p>Sedang mengalihkan ke aplikasi Instagram...</p>

      <a id="app-btn" class="btn-primary" href="${deepLinks.webUrl}">
        <span class="spinner" id="btn-spinner"></span>
        <span id="btn-label">Buka Aplikasi Instagram</span>
      </a>

      <div>
        <a id="web-fallback-link" class="btn-secondary" href="${deepLinks.webUrl}">
          Buka di browser web jika belum terpasang ↗
        </a>
      </div>
    </div>

    <script>
      (function() {
        var userAgent = navigator.userAgent || navigator.vendor || window.opera || "";
        var isAndroid = /android/i.test(userAgent);
        var isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

        var iosUrl = ${JSON.stringify(deepLinks.iosUrl)};
        var androidIntent = ${JSON.stringify(deepLinks.androidIntent)};
        var webUrl = ${JSON.stringify(deepLinks.webUrl)};

        var targetDeepLink = webUrl;
        if (isAndroid) {
          targetDeepLink = androidIntent;
        } else if (isIOS) {
          targetDeepLink = iosUrl;
        }

        var appBtn = document.getElementById("app-btn");
        if (appBtn) {
          appBtn.href = targetDeepLink;
        }

        // Auto trigger buka aplikasi
        if (isAndroid) {
          window.location.href = androidIntent;
        } else if (isIOS) {
          window.location.href = iosUrl;
        } else {
          window.location.href = webUrl;
        }

        // Fallback otomatis ke versi web jika dalam 2.5 detik aplikasi tidak terbuka
        var fallbackTimer = setTimeout(function() {
          if (!document.hidden) {
            window.location.href = webUrl;
          }
        }, 2500);

        // Hentikan timer fallback saat aplikasi Instagram aktif dibuka
        window.addEventListener("pagehide", function() { clearTimeout(fallbackTimer); });
        document.addEventListener("visibilitychange", function() {
          if (document.hidden) { clearTimeout(fallbackTimer); }
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
  let card = null;

  try {
    card = await getCard(code);
    // Toleransi variasi penulisan huruf besar/kecil dari NFC writer / scanner
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
    // Gagal koneksi ke Vercel KV (semua retry habis) → tampilkan halaman retry otomatis.
    // Pelanggan tidak perlu tap ulang; halaman akan auto-refresh dalam 2 detik.
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

  // Jika kartu memang tidak terdaftar sama sekali di database
  if (!card) {
    return new NextResponse(NOT_ACTIVE_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Cek kevalidan URL Google Review
  let targetUrl = card.googleReviewUrl?.trim();
  if (!targetUrl || !isAllowedReviewUrl(targetUrl)) {
    // Fail-safe: jika toko terdaftar tapi URL ulasan bermasalah,
    // arahkan langsung ke pencarian ulasan nama toko di Google,
    // jangan pernah menampilkan "Kartu Belum Aktif" pada kartu toko yang sudah ada!
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

  // Catat tap di background tanpa memblokir kecepatan redirect
  Promise.allSettled([
    incrementTapCount(card.code || code),
    addTapLog({ code: card.code || code, storeName: card.storeName, tappedAt: new Date().toISOString() }),
  ]).catch(() => {});

  // Jika target adalah Instagram:
  // Khusus perangkat mobile (Android & iOS), tampilkan halaman jembatan deep link
  // agar HP pengguna langsung membuka Aplikasi Instagram resmi (bukan login web browser!).
  if (isInstagramUrl(targetUrl)) {
    const userAgent = req.headers.get("user-agent") || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (isMobile) {
      const deepLinks = getInstagramDeepLinks(targetUrl);
      return new NextResponse(instagramBridgeHtml(card.storeName, deepLinks), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
        },
      });
    }
  }

  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: {
      // Cegah browser/cache menyimpan redirect ini — penting untuk NFC tap di mobile
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
    },
  });
}
