import { notFound } from "next/navigation";
import { obterCliente } from "@/lib/actions/clientes";
import { PageHeader } from "@/components/page-header";
import { ClienteForm } from "../_components/cliente-form";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await obterCliente(id);
  if (!cliente) notFound();

  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo={cliente.nome} descricao="Editar cliente." />
      <ClienteForm cliente={cliente} />
    </div>
  );
}
