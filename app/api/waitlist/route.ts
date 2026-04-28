import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, source } = body as { email?: unknown; source?: unknown };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmed = email.trim().toLowerCase();

  if (!EMAIL_RE.test(trimmed)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const { error } = await supabase.from("waitlist").insert({
    email: trimmed,
    source: typeof source === "string" ? source.trim() : null,
  });

  if (error) {
    // Postgres unique constraint violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Email already on the waitlist" },
        { status: 409 }
      );
    }
    console.error("Waitlist insert error:", error.message);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
