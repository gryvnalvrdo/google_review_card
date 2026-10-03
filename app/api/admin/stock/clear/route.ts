import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { isAdminLoggedIn } from "../../../../../lib/auth";

export async function DELETE(request: Request) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await kv.del("inventory:stock");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear stock", error);
    return NextResponse.json({ error: "Failed to clear stock" }, { status: 500 });
  }
}
