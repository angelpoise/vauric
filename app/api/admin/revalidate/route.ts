import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/adminSecret";

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidatePath("/graph");
  revalidatePath("/api/graph");
  return NextResponse.json({ ok: true });
}
