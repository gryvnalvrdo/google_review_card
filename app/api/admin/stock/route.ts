import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../../lib/auth";
import { addStokCodes, listStokCodes, removeStokCode } from "../../../../lib/kv";

const MAX_BATCH = 200;

/** GET /api/admin/stock — list semua kode stok */
export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const codes = await listStokCodes();
  return NextResponse.json({ codes, count: codes.length });
}

/** POST /api/admin/stock — simpan batch kode ke stok */
export async function POST(req: NextRequest) {
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

  const sanitized = codes
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0 && c.trim().length <= 20)
    .map((c) => c.trim());

  if (sanitized.length === 0) {
    return NextResponse.json({ error: "Tidak ada kode valid." }, { status: 400 });
  }

  await addStokCodes(sanitized);
  return NextResponse.json({ ok: true, saved: sanitized.length });
}

/** DELETE /api/admin/stock?code=xxx — hapus satu kode dari stok */
export async function DELETE(req: NextRequest) {
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
