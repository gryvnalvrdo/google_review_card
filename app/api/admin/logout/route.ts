import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidSameOrigin } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  if (!isValidSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
