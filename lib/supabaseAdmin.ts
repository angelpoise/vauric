import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS. Server-side use only, never import in client components.
// Passes cache: 'no-store' to every internal fetch so Next.js 14's fetch cache
// never serves stale Supabase responses even when the route uses force-dynamic.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: {
      fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }),
    },
  }
);
