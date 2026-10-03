import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";

export async function DELETE(
  request: Request,
  { params }: { params: { code: string } }
) {
  const session = cookies().get("admin_session")?.value;
  if (session !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = params;

  try {
    await kv.srem("inventory:stock", code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete stock code", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
