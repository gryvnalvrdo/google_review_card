import { NextRequest, NextResponse } from "next/server";
import { clearStok } from "../../../../../lib/kv";
import { isAdminLoggedIn, isValidSameOrigin } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(req: NextRequest) {
  if (!isValidSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await clearStok();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear stock", error);
    return NextResponse.json({ error: "Failed to clear stock" }, { status: 500 });
  }
}
