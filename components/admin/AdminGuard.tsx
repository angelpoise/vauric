"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface Props {
  adminEmail: string;
  children: React.ReactNode;
}

export default function AdminGuard({ adminEmail, children }: Props) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: userLoaded, user }        = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;

    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (email !== adminEmail) {
      router.replace("/graph");
    }
  }, [authLoaded, userLoaded, isSignedIn, user, adminEmail, router]);

  // Show blank dark screen while loading or redirecting
  if (!authLoaded || !userLoaded || !isSignedIn) {
    return <div style={{ minHeight: "100vh", background: "#07090f" }} />;
  }

  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (email !== adminEmail) {
    return <div style={{ minHeight: "100vh", background: "#07090f" }} />;
  }

  return <>{children}</>;
}
