import StockDetail from "@/components/StockDetail";

interface Props {
  params: { ticker: string };
}

export default function StockPage({ params }: Props) {
  return <StockDetail ticker={params.ticker.toUpperCase()} />;
}
