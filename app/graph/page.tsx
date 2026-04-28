import type { Metadata } from "next";
import GraphLayout from "@/components/GraphLayout";

export const metadata: Metadata = {
  title: "Vauric — Knowledge Graph",
};

export default function GraphPage() {
  return <GraphLayout />;
}
