import { NextRequest, NextResponse } from "next/server";
import { getCard } from "../../../lib/kv";
import { isAllowedReviewUrl } from "../../../lib/redirect";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const card = await getCard(params.code);

  // Jika kartu tidak ditemukan, redirect ke halaman error yang sudah ada
  if (!card || !isAllowedReviewUrl(card.googleReviewUrl)) {
    return NextResponse.redirect(new URL(`/c/${params.code}`, _req.url), { status: 302 });
  }

  const reviewUrl = card.googleReviewUrl;
  const storeName = card.storeName || "Toko";

  const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Terima Kasih — ${storeName}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
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
      .blob {
        position: fixed;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.13;
        pointer-events: none;
        animation: pulse 6s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 0.13; }
        50% { transform: scale(1.08); opacity: 0.18; }
      }
      .blob-1 { width: 420px; height: 420px; background: #10B981; top: -140px; left: -80px; animation-delay: 0s; }
      .blob-2 { width: 360px; height: 360px; background: #4F46E5; bottom: -100px; right: -60px; animation-delay: -3s; }

      .card {
        background: #111118;
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 24px;
        padding: 44px 32px 36px;
        text-align: center;
        max-width: 400px;
        width: 100%;
        position: relative;
        z-index: 1;
        box-shadow: 0 8px 48px rgba(0,0,0,0.55);
        animation: slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(28px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      .icon-ring {
        width: 72px; height: 72px;
        background: rgba(16,185,129,0.12);
        border: 2px solid rgba(16,185,129,0.35);
        border-radius: 22px;
        display: flex; align-items: center; justify-content: center;
        font-size: 2rem;
        margin: 0 auto 22px;
        animation: pop 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes pop {
        from { transform: scale(0.6); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }

      .store-name {
        font-size: 0.75rem;
        font-weight: 700;
        color: #34D399;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
      }
      h1 {
        font-size: 1.45rem;
        font-weight: 800;
        margin-bottom: 10px;
        line-height: 1.25;
      }
      .subtitle {
        color: #9A9AB0;
        font-size: 0.9rem;
        line-height: 1.65;
        margin-bottom: 28px;
      }

      .cta-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 24px;
        background: linear-gradient(135deg, #10B981, #059669);
        color: #fff;
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 700;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        text-decoration: none;
        box-shadow: 0 4px 20px rgba(16,185,129,0.35);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        margin-bottom: 14px;
      }
      .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(16,185,129,0.45); }
      .cta-btn:active { transform: scale(0.97); }

      .countdown-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .countdown-ring {
        position: relative;
        width: 28px;
        height: 28px;
        flex-shrink: 0;
      }
      .countdown-ring svg {
        transform: rotate(-90deg);
      }
      .countdown-ring .track {
        fill: none;
        stroke: rgba(255,255,255,0.08);
        stroke-width: 3;
      }
      .countdown-ring .progress {
        fill: none;
        stroke: #34D399;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-dasharray: 69.12;
        stroke-dashoffset: 0;
        transition: stroke-dashoffset 1s linear;
      }
      .countdown-num {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.68rem;
        font-weight: 800;
        color: #34D399;
      }
      .countdown-text {
        font-size: 0.78rem;
        color: #64748B;
        font-weight: 500;
      }

      .stars {
        display: flex;
        justify-content: center;
        gap: 4px;
        margin-bottom: 18px;
        animation: starsIn 0.6s 0.5s both;
      }
      @keyframes starsIn {
        from { opacity: 0; transform: scale(0.8); }
        to   { opacity: 1; transform: scale(1); }
      }
      .star { font-size: 1.5rem; }
    </style>
  </head>
  <body>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>

    <div class="card">
      <div class="icon-ring">⭐</div>
      <div class="store-name">${storeName}</div>
      <h1>Terima Kasih sudah berkunjung!</h1>
      <div class="stars">
        <span class="star">⭐</span>
        <span class="star">⭐</span>
        <span class="star">⭐</span>
        <span class="star">⭐</span>
        <span class="star">⭐</span>
      </div>
      <p class="subtitle">
        Ulasan Anda sangat berarti bagi kami.<br>
        Hanya butuh 30 detik untuk meninggalkan ulasan di Google 🙏
      </p>

      <a class="cta-btn" href="${reviewUrl}" id="reviewBtn">
        ⭐ Beri Ulasan di Google
      </a>

      <div class="countdown-wrap">
        <div class="countdown-ring">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <circle class="track" cx="12" cy="12" r="11"/>
            <circle class="progress" cx="12" cy="12" r="11" id="progressCircle"/>
          </svg>
          <div class="countdown-num" id="countdownNum">5</div>
        </div>
        <span class="countdown-text">Otomatis lanjut ke Google Review...</span>
      </div>
    </div>

    <script>
      const TOTAL = 5;
      const CIRCUMFERENCE = 2 * Math.PI * 11; // 69.12
      const circle = document.getElementById('progressCircle');
      const numEl = document.getElementById('countdownNum');
      let remaining = TOTAL;

      function tick() {
        remaining--;
        numEl.textContent = remaining;
        const pct = remaining / TOTAL;
        circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
        if (remaining <= 0) {
          window.location.href = ${JSON.stringify(reviewUrl)};
        }
      }

      // Mulai countdown setelah 500ms agar animasi card selesai dulu
      circle.style.strokeDashoffset = '0';
      setTimeout(() => {
        const timer = setInterval(tick, 1000);
        // Tap tombol langsung redirect dan stop timer
        document.getElementById('reviewBtn').addEventListener('click', (e) => {
          clearInterval(timer);
        });
      }, 500);
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
