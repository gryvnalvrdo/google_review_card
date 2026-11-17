import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn, isValidSameOrigin } from "../../../../lib/auth";
import { addStokCodes, listCards, listStokCodes, removeStokCode } from "../../../../lib/kv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BATCH = 200;
const CODE_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const codes = await listStokCodes();
  return NextResponse.json(
    { codes, count: codes.length },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" } }
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
  const codes: unknown = body?.codes;

  if (!Array.isArray(codes) || codes.length === 0) {
    return NextResponse.json({ error: "Field 'codes' harus array tidak kosong." }, { status: 400 });
  }
  if (codes.length > MAX_BATCH) {
    return NextResponse.json({ error: `Maksimal ${MAX_BATCH} kode per batch.` }, { status: 400 });
  }

  const activeCards = await listCards();
  const activeSet = new Set(activeCards.map((c) => c.code.toLowerCase()));

  const sanitized = Array.from(
    new Set(
      codes
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => CODE_PATTERN.test(c) && c.toLowerCase() !== "_index" && !activeSet.has(c.toLowerCase()))
    )
  );

  if (sanitized.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada kode stok baru yang valid atau semua kode sudah aktif." },
      { status: 400 }
    );
  }

  await addStokCodes(sanitized);
  return NextResponse.json({ ok: true, saved: sanitized.length });
}

export async function DELETE(req: NextRequest) {
  if (!isValidSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Query param 'code' wajib diisi." }, { status: 400 });
  }

  await removeStokCode(code);
  return NextResponse.json({ ok: true });
}
