export const runtime = 'nodejs'

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  // Not authenticated
  if (!userId) redirect("/");

  const user = await currentUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail  = user?.emailAddresses?.[0]?.emailAddress ?? null;

  console.log(
    `[admin] user=${userEmail ?? "null"} | ADMIN_EMAIL=${(adminEmail ?? "").slice(0, 4)}... | match=${userEmail === adminEmail}`
  );

  // Authenticated but not admin
  if (!adminEmail || userEmail !== adminEmail) redirect("/graph");

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
