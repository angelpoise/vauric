import StockDetail from "@/components/StockDetail";
import AppHeader from "@/components/AppHeader";

interface Props {
  params: { ticker: string };
}

export default function StockPage({ params }: Props) {
  return (
    <>
      <AppHeader />
      <StockDetail ticker={params.ticker.toUpperCase()} />
    </>
  );
}
