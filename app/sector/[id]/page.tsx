import SectorDetail from "@/components/SectorDetail";
import AppHeader from "@/components/AppHeader";

interface Props {
  params: { id: string };
}

export default function SectorPage({ params }: Props) {
  return (
    <>
      <AppHeader />
      <SectorDetail id={params.id.toLowerCase()} />
    </>
  );
}
