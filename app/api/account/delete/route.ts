import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Delete Supabase data first
  await supabaseAdmin
    .from("user_preferences")
    .delete()
    .eq("clerk_user_id", userId);

  // Delete user from Clerk via Management API
  const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    },
  });

  if (!clerkRes.ok) {
    const err = await clerkRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "Failed to delete account" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
