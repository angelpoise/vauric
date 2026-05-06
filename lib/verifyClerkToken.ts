import { verifyToken } from "@clerk/backend";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Verifies a Clerk session JWT from an Authorization: Bearer header.
 * Returns the Clerk userId (sub claim) on success, null on failure.
 * Existing callers rely on this string | null return type.
 */
export async function verifyClerkToken(
  authHeader: string | null,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifies a Clerk session JWT and resolves isPro from publicMetadata.
 * Works without Clerk middleware — suitable for routes that need tier info.
 */
export async function verifyClerkTokenWithTier(
  authHeader: string | null,
): Promise<{ userId: string | null; isPro: boolean }> {
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, isPro: false };
  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const userId = payload.sub ?? null;
    if (!userId) return { userId: null, isPro: false };

    // Fast path: Clerk JWT template may include publicMetadata as "metadata"
    const meta = (payload as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined;
    if (typeof meta?.isPro === "boolean") {
      return { userId, isPro: meta.isPro };
    }

    // Fallback: fetch publicMetadata via Clerk Admin API
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return { userId, isPro: user.publicMetadata?.isPro === true };
  } catch {
    return { userId: null, isPro: false };
  }
}
