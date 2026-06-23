import Link from "next/link";
import { MessagesSquare, Settings2 } from "lucide-react";
import { listarConversas } from "@/lib/actions/conversas";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "./_components/auto-refresh";
import { ConversaLinha } from "./_components/conversa-linha";

export default async function ConversasPage() {
  const conversas = await listarConversas();

  return (
    <div className="space-y-6 p-8">
      <AutoRefresh segundos={10} />
      <PageHeader
        titulo="Conversas (WhatsApp)"
        descricao="Inbox da Hígia. Clique na linha para abrir a conversa. Em atendimento humano, use 'Devolver à Hígia' para a IA reassumir."
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
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {conversas.map((c) => (
                <ConversaLinha key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
