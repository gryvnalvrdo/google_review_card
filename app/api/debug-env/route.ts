import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "../../../lib/auth";

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    has_KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    has_KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    has_KV_REST_API_URL_KV_REST_API_URL: !!process.env.KV_REST_API_URL_KV_REST_API_URL,
    has_KV_REST_API_URL__REST_API_TOKEN: !!process.env.KV_REST_API_URL__REST_API_TOKEN,
    all_env_keys: Object.keys(process.env).filter(k => k.includes("KV") || k.includes("REST") || k.includes("REDIS")),
  });
}
