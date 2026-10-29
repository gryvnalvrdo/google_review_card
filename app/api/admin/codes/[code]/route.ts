import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../../../lib/auth";
import { deleteCard, resetCardTaps } from "../../../../../lib/kv";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = params.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Kode tidak valid." }, { status: 400 });
  }

  await deleteCard(code);
  return NextResponse.json({ ok: true });
}

/** POST /api/admin/codes/[code] — Reset riwayat & hitungan tap kartu tertentu ke 0 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = params.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Kode tidak valid." }, { status: 400 });
  }

  await resetCardTaps(code);
  return NextResponse.json({ ok: true, reset: true });
}
