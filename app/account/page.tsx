import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AccountPage from "@/components/AccountPage";

export const metadata: Metadata = {
  title: "Vauric — Account",
};

export default function AccountRoute() {
  return (
    <AppShell>
      <AccountPage />
    </AppShell>
  );
}
