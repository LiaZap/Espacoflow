import { notFound } from "next/navigation";
import { obterSala } from "@/lib/actions/salas";
import { PageHeader } from "@/components/page-header";
import { SalaForm } from "../_components/sala-form";

export default async function EditarSalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sala = await obterSala(id);
  if (!sala) notFound();

  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo={sala.nome} descricao="Editar sala." />
      <SalaForm sala={sala} />
    </div>
  );
}
