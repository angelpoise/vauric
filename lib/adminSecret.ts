import type { NextRequest } from "next/server";
import { verifyClerkToken } from "@/lib/verifyClerkToken";
import { clerkClient } from "@clerk/nextjs/server";

// In-process cache of verified admin user IDs — avoids a Clerk API round-trip
// on every request after the first successful verification.
const adminCache = new Set<string>();

/**
 * Returns true if the request carries a valid Clerk session token belonging
 * to the ADMIN_EMAIL user. No longer relies on NEXT_PUBLIC_ADMIN_SECRET.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const userId = await verifyClerkToken(req.headers.get("authorization"));
  if (!userId) return false;

  if (adminCache.has(userId)) return true;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const ok = user.emailAddresses.some((e) => e.emailAddress === adminEmail);
    if (ok) adminCache.add(userId);
    return ok;
  } catch {
    return false;
  }
}
