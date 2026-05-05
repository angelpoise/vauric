import { verifyToken } from "@clerk/backend";

/**
 * Verifies a Clerk session JWT from an Authorization: Bearer header.
 * Returns the Clerk userId (sub claim) on success, null on failure.
 */
export async function verifyClerkToken(
  authHeader: string | null
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
