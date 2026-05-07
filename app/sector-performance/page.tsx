import type { Metadata } from "next";
import SectorDashboard from "@/components/SectorDashboard";

export const metadata: Metadata = {
  title: "Sector Performance | Vauric",
  description: "Live performance across all tracked sectors",
};

export default function SectorPerformancePage() {
  return <SectorDashboard />;
}
