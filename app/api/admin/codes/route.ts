import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../../lib/auth";
import { getCard, setCard, listCards, removeStokCode } from "../../../../lib/kv";
import { isAllowedReviewUrl } from "../../../../lib/redirect";

const MAX_CODE_LEN = 20;
const MAX_NAME_LEN = 100;
const MAX_URL_LEN = 2000;

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
  const price = typeof body?.price === "number" ? body.price : 50000;

  if (!code || !storeName || !googleReviewUrl) {
    return NextResponse.json(
      { error: "code, storeName, dan googleReviewUrl wajib diisi." },
      { status: 400 }
    );
  }

  // Validasi panjang input
  if (code.length > MAX_CODE_LEN) {
    return NextResponse.json({ error: `Kode terlalu panjang (maks ${MAX_CODE_LEN} karakter).` }, { status: 400 });
  }
  if (storeName.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: `Nama toko terlalu panjang (maks ${MAX_NAME_LEN} karakter).` }, { status: 400 });
  }
  if (googleReviewUrl.length > MAX_URL_LEN) {
    return NextResponse.json({ error: `URL terlalu panjang (maks ${MAX_URL_LEN} karakter).` }, { status: 400 });
  }

  if (!isAllowedReviewUrl(googleReviewUrl)) {
    return NextResponse.json(
      { error: "Link harus berupa link Google Review resmi (search.google.com atau google.com). Link lain ditolak demi keamanan." },
      { status: 400 }
    );
  }

  const existing = await getCard(code);
  const now = new Date().toISOString();

  await setCard({
    code,
    storeName,
    googleReviewUrl,
    price,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  // Hapus dari stok jika ada (kartu sudah di-assign ke toko)
  await removeStokCode(code);

  return NextResponse.json({ ok: true });
}
