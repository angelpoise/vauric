import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import SectorDashboard from "@/components/SectorDashboard";

export const metadata: Metadata = {
  title: "Sector Performance | Vauric",
  description: "Live performance across all tracked sectors",
};

export default function SectorPerformancePage() {
  return (
    <AppShell>
      <SectorDashboard />
    </AppShell>
  );
}
