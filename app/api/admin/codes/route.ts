import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn, isValidSameOrigin } from "../../../../lib/auth";
import { getCard, setCard, listCards, removeStokCode, resetCardTaps } from "../../../../lib/kv";
import { isAllowedReviewUrl } from "../../../../lib/redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_CODE_LEN = 20;
const MAX_NAME_LEN = 100;
const MAX_URL_LEN = 2000;
const MAX_MONEY = 100_000_000;
const CODE_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cards = await listCards();
  return NextResponse.json(
    { cards },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  if (!isValidSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const storeName = typeof body?.storeName === "string" ? body.storeName.trim() : "";
  const googleReviewUrl = typeof body?.googleReviewUrl === "string" ? body.googleReviewUrl.trim() : "";
  const rawPrice = body?.price;
  const rawCost = body?.cost ?? body?.modal;
  const price =
    typeof rawPrice === "number" && Number.isFinite(rawPrice)
      ? Math.min(MAX_MONEY, Math.max(0, Math.round(rawPrice)))
      : 50000;
  const cost =
    typeof rawCost === "number" && Number.isFinite(rawCost)
      ? Math.min(MAX_MONEY, Math.max(0, Math.round(rawCost)))
      : 0;
  const explicitResetTap = Boolean(body?.resetTaps || body?.resetTap);

  if (!code || !storeName || !googleReviewUrl) {
    return NextResponse.json(
      { error: "code, storeName, dan googleReviewUrl wajib diisi." },
      { status: 400 }
    );
  }

  if (code.length > MAX_CODE_LEN || !CODE_PATTERN.test(code) || code.toLowerCase() === "_index") {
    return NextResponse.json(
      { error: `Format kode hanya boleh huruf, angka, '-' atau '_' (3 s/d ${MAX_CODE_LEN} karakter).` },
      { status: 400 }
    );
  }
  if (storeName.length > MAX_NAME_LEN) {
    return NextResponse.json(
      { error: `Nama toko terlalu panjang (maks ${MAX_NAME_LEN} karakter).` },
      { status: 400 }
    );
  }
  if (googleReviewUrl.length > MAX_URL_LEN) {
    return NextResponse.json(
      { error: `URL terlalu panjang (maks ${MAX_URL_LEN} karakter).` },
      { status: 400 }
    );
  }

  if (!isAllowedReviewUrl(googleReviewUrl)) {
    return NextResponse.json(
      {
        error:
          "Link harus berupa link Google Review/Maps resmi atau link/profil Instagram resmi. Link lain ditolak demi keamanan.",
      },
      { status: 400 }
    );
  }

  const existing = await getCard(code);
  const now = new Date().toISOString();

  const isTargetChanged = Boolean(
    existing && existing.googleReviewUrl.trim() !== googleReviewUrl.trim()
  );
  const shouldReset = Boolean(explicitResetTap || isTargetChanged);

  if (shouldReset) {
    await resetCardTaps(code);
  }

  await setCard({
    code,
    storeName,
    googleReviewUrl,
    price,
    cost,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await removeStokCode(code);

  return NextResponse.json({
    ok: true,
    tapsReset: shouldReset,
  });
}
