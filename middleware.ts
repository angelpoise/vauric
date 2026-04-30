import { clerkMiddleware } from '@clerk/nextjs/server'

// Runs passively on all routes to establish Clerk session context.
// Does NOT protect any route — admin protection is handled in app/admin/layout.tsx.
export default clerkMiddleware()

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs',
}
