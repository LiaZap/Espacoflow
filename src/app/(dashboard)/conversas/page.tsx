import Link from "next/link";
import { MessagesSquare, Settings2 } from "lucide-react";
import { listarConversas } from "@/lib/actions/conversas";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "./_components/auto-refresh";
import { formatarDataHora } from "@/lib/utils";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "success" | "warning"> = {
  higia: "default",
  humano: "warning",
  pausado: "secondary",
};

export default async function ConversasPage() {
  const conversas = await listarConversas();

  return (
    <div className="space-y-6 p-8">
      <AutoRefresh segundos={10} />
      <PageHeader
        titulo="Conversas (WhatsApp)"
        descricao="Inbox da Hígia. Clique numa conversa para abrir e responder."
        acao={
          <Button asChild variant="outline">
            <Link href="/configuracoes/whatsapp">
              <Settings2 className="h-4 w-4" /> Conectar / Simular
            </Link>
          </Button>
        }
      />

      {conversas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <MessagesSquare className="h-8 w-8" />
          <p>Nenhuma conversa ainda. Elas aparecem aqui quando o webhook do WhatsApp estiver ativo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Atendimento</th>
                <th className="px-4 py-3 font-medium">Não lidas</th>
                <th className="px-4 py-3 font-medium">Última mensagem</th>
              </tr>
            </thead>
            <tbody>
              {conversas.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/conversas/${c.id}`} className="text-primary hover:underline">
                      {c.cliente_nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.telefone}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTE[c.status] ?? "secondary"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.nao_lidas}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.ultima_mensagem_em ? formatarDataHora(c.ultima_mensagem_em) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
