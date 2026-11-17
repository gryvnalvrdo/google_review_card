import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn, isValidSameOrigin } from "../../../../../lib/auth";
import { deleteCard, resetCardTaps } from "../../../../../lib/kv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
};
const CODE_PATTERN = /^[a-zA-Z0-9_-]{1,20}$/;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  if (!isValidSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = params.code?.trim();
  if (!code || !CODE_PATTERN.test(code) || code.toLowerCase() === "_index") {
    return NextResponse.json({ error: "Kode tidak valid." }, { status: 400 });
  }

  await deleteCard(code);
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  if (!isValidSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = params.code?.trim();
  if (!code || !CODE_PATTERN.test(code) || code.toLowerCase() === "_index") {
    return NextResponse.json({ error: "Kode tidak valid." }, { status: 400 });
  }

  await resetCardTaps(code);
  return NextResponse.json({ ok: true, reset: true, tapCount: 0 }, { headers: NO_STORE_HEADERS });
}
