import { PageHeader } from "@/components/page-header";
import { ClienteForm } from "../_components/cliente-form";

export default function NovoClientePage() {
  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="Novo cliente" descricao="Cadastre um lead ou cliente do coworking." />
      <ClienteForm />
    </div>
  );
}
