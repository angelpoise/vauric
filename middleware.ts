import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(async (auth, req) => {
  // Only protect /admin routes — all other routes are fully public
  if (req.nextUrl.pathname.startsWith('/admin')) {
    await auth.protect()
  }
})

export const config = {
  // Run middleware only on /admin routes — nothing else
  matcher: ['/admin', '/admin/(.*)'],
}
