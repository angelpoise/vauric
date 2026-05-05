interface Entry {
  count: number;
  resetAt: number;
}

// Module-level store — persists for the lifetime of the server process.
// Acceptable for current scale; replace with Redis for multi-instance deploys.
const store = new Map<string, Entry>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique key (e.g. IP + route)
 * @param max      Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
