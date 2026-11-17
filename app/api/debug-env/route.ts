import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../lib/auth";

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.KV_REST_API_URL_KV_REST_API_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_URL_KV_REST_API_TOKEN);
  return NextResponse.json({
    kvConfigured: hasUrl && hasToken,
    hasUrl,
    hasToken,
  });
}
