import { listarMidia } from "@/lib/actions/agente-midia";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MidiaManager } from "../agente/_components/midia-manager";

export default async function MidiaPage() {
  const midias = await listarMidia();

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Fotos da Hígia"
        descricao="Central de fotos e arquivos que a Hígia envia no WhatsApp (fotos das salas, PDFs de preços/planos)."
      />

      <Card>
        <CardHeader>
          <CardTitle>Biblioteca de mídia</CardTitle>
          <CardDescription>
            Suba as fotos/PDFs, defina o identificador e a legenda. A Hígia envia automaticamente quando o
            cliente pedir para ver as salas. Desative o que não quiser que ela mande.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MidiaManager midias={midias} />
        </CardContent>
      </Card>
    </div>
  );
}
