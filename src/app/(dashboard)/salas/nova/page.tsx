import { PageHeader } from "@/components/page-header";
import { SalaForm } from "../_components/sala-form";

export default function NovaSalaPage() {
  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="Nova sala" descricao="Cadastre uma sala privativa." />
      <SalaForm />
    </div>
  );
}
