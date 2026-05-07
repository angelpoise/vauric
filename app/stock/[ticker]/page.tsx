import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import StockDetail from "@/components/StockDetail";
import AppHeader from "@/components/AppHeader";

interface Props {
  params: { ticker: string };
}

export default async function StockPage({ params }: Props) {
  const ticker = params.ticker.toUpperCase();

  // Validate ticker against admin_stocks — unknown strings return 404
  const { data } = await supabaseAdmin
    .from("admin_stocks")
    .select("ticker")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!data) return notFound();

  return (
    <>
      <AppHeader />
      <StockDetail ticker={ticker} />
    </>
  );
}
