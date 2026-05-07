import type { Metadata } from "next";
import PortfolioTracker from "@/components/PortfolioTracker";

export const metadata: Metadata = {
  title: "Portfolio | Vauric",
  description: "Track your stock portfolio",
};

export default function PortfolioPage() {
  return <PortfolioTracker />;
}
