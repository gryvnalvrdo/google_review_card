import { NextRequest, NextResponse } from "next/server";
import { removeStokCode } from "../../../../../lib/kv";
import { isAdminLoggedIn, isValidSameOrigin } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  try {
    await removeStokCode(code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete stock code", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
