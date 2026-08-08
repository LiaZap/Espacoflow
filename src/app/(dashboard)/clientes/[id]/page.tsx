import { notFound } from "next/navigation";
import { obterCliente, listarClientes } from "@/lib/actions/clientes";
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
  // Candidatos a TITULAR do saldo (empresa com mais de um contato autorizado).
  const titulares = (await listarClientes()).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone }));

  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo={cliente.nome} descricao="Editar cliente." />
      <ClienteForm cliente={cliente} titulares={titulares} />
    </div>
  );
}
