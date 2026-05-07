import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import AccountPage from "@/components/AccountPage";

export const metadata: Metadata = {
  title: "Vauric — Account",
};

export default function AccountRoute() {
  return (
    <>
      <AppHeader />
      <AccountPage />
    </>
  );
}
