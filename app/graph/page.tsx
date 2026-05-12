import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import GraphLayout from "@/components/GraphLayout";

export const metadata: Metadata = {
  title: "Vauric — Knowledge Graph",
};

export default async function GraphPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <GraphLayout />;
}
