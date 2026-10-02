import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../../../lib/auth";
import { deleteCard } from "../../../../../lib/kv";

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
