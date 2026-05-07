import SectorDetail from "@/components/SectorDetail";
import AppShell from "@/components/AppShell";

interface Props {
  params: { id: string };
}

export default function SectorPage({ params }: Props) {
  return (
    <AppShell>
      <SectorDetail id={params.id.toLowerCase()} />
    </AppShell>
  );
}
