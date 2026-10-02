import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../../lib/auth";
import { getCard, setCard, listCards } from "../../../../lib/kv";
import { isAllowedReviewUrl } from "../../../../lib/redirect";

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cards = await listCards();
  return NextResponse.json({ cards });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code = body?.code?.trim();
  const storeName = body?.storeName?.trim();
  const googleReviewUrl = body?.googleReviewUrl?.trim();

  if (!code || !storeName || !googleReviewUrl) {
    return NextResponse.json(
      { error: "code, storeName, dan googleReviewUrl wajib diisi." },
      { status: 400 }
    );
  }

  if (!isAllowedReviewUrl(googleReviewUrl)) {
    return NextResponse.json(
      {
        error:
          "Link harus berupa link Google Review resmi (search.google.com atau google.com). Link lain ditolak demi keamanan.",
      },
      { status: 400 }
    );
  }

  const existing = await getCard(code);
  const now = new Date().toISOString();

  await setCard({
    code,
    storeName,
    googleReviewUrl,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true });
}
