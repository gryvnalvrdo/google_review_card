import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../../lib/auth";
import { getTapLogs } from "../../../../lib/kv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 25000);

  const logs = await getTapLogs(limit);
  return NextResponse.json(
    { logs },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
