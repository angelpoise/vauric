import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terms",
  "/privacy",
]);

export default clerkMiddleware(async (auth, req) => {
  // API routes handle their own auth — don't redirect them, but let Clerk
  // middleware run so auth() is available via session cookies in those routes.
  if (req.nextUrl.pathname.startsWith("/api/")) return;

  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Run on all routes except static Next.js internals and file extensions
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes so auth() works server-side
    "/(api|trpc)(.*)",
  ],
};
