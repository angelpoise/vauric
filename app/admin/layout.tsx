import AdminNav from "@/components/admin/AdminNav";
import AdminGuard from "@/components/admin/AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "";

  return (
    <AdminGuard adminEmail={adminEmail}>
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
    </AdminGuard>
  );
}
