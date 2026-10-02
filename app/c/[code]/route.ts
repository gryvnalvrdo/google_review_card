import { NextRequest, NextResponse } from "next/server";
import { getCard } from "../../../lib/kv";
import { isAllowedReviewUrl } from "../../../lib/redirect";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const card = await getCard(params.code);

  if (!card || !isAllowedReviewUrl(card.googleReviewUrl)) {
    // Kode belum pernah di-assign (atau datanya rusak) -> jangan error,
    // tampilkan halaman netral.
    return new NextResponse(
      `<!doctype html>
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
            .blob {
              position: fixed;
              border-radius: 50%;
              filter: blur(80px);
              opacity: 0.12;
              pointer-events: none;
            }
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
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return NextResponse.redirect(card.googleReviewUrl, { status: 302 });
}
