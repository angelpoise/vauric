export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      "X-Admin-Secret": secret,
    },
  });
}
