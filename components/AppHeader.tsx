import Link from "next/link";
import Logo from "@/components/Logo";
import AuthHeader from "@/components/AuthHeader";

export default function AppHeader() {
  return (
    <header
      style={{
        background: "#0d1117",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        position: "relative",
        zIndex: 10,
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <Logo variant="default" />
      </Link>
      <div style={{ marginLeft: "auto" }}>
        <AuthHeader />
      </div>
    </header>
  );
}
