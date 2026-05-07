import type { Metadata } from "next";
import EarningsCalendar from "@/components/EarningsCalendar";

export const metadata: Metadata = {
  title: "Earnings Calendar | Vauric",
  description: "Upcoming earnings for tracked stocks",
};

export default function EarningsPage() {
  return <EarningsCalendar />;
}
