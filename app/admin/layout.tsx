import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // Debug: log auth state on every admin request to diagnose production issues
  const adminEmail = process.env.ADMIN_EMAIL ?? "(ADMIN_EMAIL not set)";
  const userEmail  = user?.emailAddresses?.[0]?.emailAddress ?? null;
  console.log(
    `[admin] user=${userEmail ?? "null"} | ADMIN_EMAIL=${adminEmail.slice(0, 4)}... | match=${userEmail === process.env.ADMIN_EMAIL}`
  );

  // Unauthenticated — redirect to homepage; middleware's auth.protect() is
  // the primary gate and should redirect to Clerk sign-in before reaching here
  if (!user) redirect("/");

  // Authenticated but not admin → back to app
  if (!process.env.ADMIN_EMAIL || !user.emailAddresses.some((e) => e.emailAddress === process.env.ADMIN_EMAIL)) {
    redirect("/graph");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07090f",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        color: "#f1f5f9",
      }}
    >
      <AdminNav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px 80px" }}>
        {children}
      </main>
    </div>
  );
}
