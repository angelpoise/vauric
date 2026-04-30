import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // Unauthenticated → sign-in (middleware should catch this first, but handle defensively)
  if (!user) redirect("/sign-in");

  // Authenticated but not admin → back to app
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !user.emailAddresses.some((e) => e.emailAddress === adminEmail)) {
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
