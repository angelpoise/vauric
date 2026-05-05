import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "40px 24px",
      }}
    >
      <Link href="/graph" style={{ textDecoration: "none" }}>
        <Logo variant="default" />
      </Link>

      <SignIn />

      <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
        Don&apos;t have an account?{" "}
        <Link href="/" style={{ color: "#3b82f6", textDecoration: "none" }}>
          Join the waitlist
        </Link>
      </p>
    </main>
  );
}
