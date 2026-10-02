import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValue,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE_SECONDS,
  isRateLimited,
  verifyPassword,
} from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const password = body?.password;

  if (!password || typeof password !== "string" || password.length > 200) {
    return NextResponse.json({ error: "Password tidak valid." }, { status: 400 });
  }

  // Timing-safe comparison — tidak menggunakan === langsung
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Password salah." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
