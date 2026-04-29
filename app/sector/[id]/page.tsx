import SectorDetail from "@/components/SectorDetail";

interface Props {
  params: { id: string };
}

export default function SectorPage({ params }: Props) {
  return <SectorDetail id={params.id.toLowerCase()} />;
}
