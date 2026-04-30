import { NextRequest } from "next/server";

export function isAdminRequest(req: NextRequest): boolean {
  // Validates against the public-facing secret that client components send.
  // ADMIN_SECRET is kept separate for server-to-server calls (e.g. pipeline trigger).
  const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET;
  const header = req.headers.get("x-admin-secret");
  return !!(secret && header === secret);
}
