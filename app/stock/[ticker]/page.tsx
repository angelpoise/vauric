import StockDetail from "@/components/StockDetail";
import AppShell from "@/components/AppShell";

interface Props {
  params: { ticker: string };
}

export default function StockPage({ params }: Props) {
  return (
    <AppShell>
      <StockDetail ticker={params.ticker.toUpperCase()} />
    </AppShell>
  );
}
