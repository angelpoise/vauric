import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const { userId } = await auth()
    if (!userId) {
      // Redirect unauthenticated users to homepage (no /sign-in page exists)
      return NextResponse.redirect(new URL('/', req.url))
    }
  }
})

export const config = {
  matcher: ['/admin', '/admin/(.*)'],
}
