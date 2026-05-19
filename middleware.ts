import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Stripe webhooks must arrive as raw POST requests with no auth processing.
// Exclude them from the matcher entirely so Clerk never touches them.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals, static files, AND the Stripe webhook endpoint
    "/((?!_next|api/stripe/webhook|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(trpc)(.*)",
    // API routes except stripe/webhook
    "/api/((?!stripe/webhook).*)",
  ],
};

// Suppress unused import warning
void (NextResponse as unknown);
