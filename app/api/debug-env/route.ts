import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    has_KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    has_KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    has_KV_REST_API_URL_KV_REST_API_URL: !!process.env.KV_REST_API_URL_KV_REST_API_URL,
    has_KV_REST_API_URL__REST_API_TOKEN: !!process.env.KV_REST_API_URL__REST_API_TOKEN,
    all_env_keys: Object.keys(process.env).filter(k => k.includes("KV") || k.includes("REST") || k.includes("REDIS")),
  });
}
