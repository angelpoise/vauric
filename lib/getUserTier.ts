import { auth, currentUser } from "@clerk/nextjs/server";

export interface UserTier {
  userId: string | null;
  isPro: boolean;
}

export async function getUserTier(): Promise<UserTier> {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) return { userId: null, isPro: false };

    // Fast path: Clerk includes publicMetadata as "metadata" in the JWT when
    // the session token template is configured to do so.
    const meta = (sessionClaims?.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.isPro === "boolean") {
      return { userId, isPro: meta.isPro };
    }

    // Fallback: fetch directly from Clerk (always fresh, one extra API call)
    const user = await currentUser();
    return { userId, isPro: user?.publicMetadata?.isPro === true };
  } catch {
    // auth() requires Clerk middleware. If middleware is absent or auth context
    // is unavailable, default to free tier rather than crashing the route.
    return { userId: null, isPro: false };
  }
}
