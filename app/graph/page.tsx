import type { Metadata } from "next";
import GraphCanvas from "@/components/GraphCanvas";

export const metadata: Metadata = {
  title: "Vauric — Knowledge Graph",
};

export default function GraphPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#07090f",
        overflow: "hidden",
      }}
    >
      <GraphCanvas />
    </div>
  );
}
