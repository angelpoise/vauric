/**
 * Wraps fetch with the current Clerk session Bearer token so admin panel
 * components can authenticate without importing hooks or passing tokens manually.
 * Reads from window.Clerk which Clerk's browser SDK populates after load.
 */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token: string | null = null;
  if (typeof window !== "undefined") {
    try {
      const w = window as Window & {
        Clerk?: { session?: { getToken(): Promise<string | null> } };
      };
      if (w.Clerk?.session) {
        token = await w.Clerk.session.getToken();
      }
    } catch { /* session unavailable — request proceeds without auth */ }
  }
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
