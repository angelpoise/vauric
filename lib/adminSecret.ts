import { NextRequest } from "next/server";

export function isAdminRequest(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  const header = req.headers.get("x-admin-secret");
  return !!(secret && header === secret);
}
