type ClerkWindow = Window & {
  Clerk?: {
    session?: { getToken(): Promise<string | null> };
    loaded?: boolean;
  };
};

async function getClerkToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const w = window as ClerkWindow;

  // Wait up to 3 s for Clerk to finish loading (handles race on first render)
  if (!w.Clerk?.session) {
    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 3000;
      const poll = setInterval(() => {
        if (w.Clerk?.session || Date.now() >= deadline) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
    });
  }

  try {
    return (await w.Clerk?.session?.getToken()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Wraps fetch with the current Clerk session Bearer token so admin panel
 * components can authenticate without importing hooks or passing tokens manually.
 */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getClerkToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
