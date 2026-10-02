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
        <head><meta charset="utf-8" /><title>Kartu belum aktif</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;
            align-items:center;justify-content:center;margin:0;background:#f7f7f8;color:#222}
          .box{max-width:360px;text-align:center;padding:24px}
          h1{font-size:1.2rem;margin-bottom:8px}
          p{color:#666;font-size:0.95rem}
        </style>
        </head>
        <body>
          <div class="box">
            <h1>Kartu belum aktif</h1>
            <p>Kartu ini belum terhubung ke toko manapun. Hubungi penyedia kartu Anda.</p>
          </div>
        </body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return NextResponse.redirect(card.googleReviewUrl, { status: 302 });
}
