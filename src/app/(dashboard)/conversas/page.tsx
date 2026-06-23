import Link from "next/link";
import { MessagesSquare, Settings2, ArrowLeft } from "lucide-react";
import { listarConversas, obterConversa } from "@/lib/actions/conversas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatarDataHora } from "@/lib/utils";
import { AutoRefresh } from "./_components/auto-refresh";
import { ListaItem } from "./_components/lista-item";
import { ChatMensagens } from "./_components/chat-mensagens";
import { ChatComposer } from "./_components/chat-composer";
import { ControlesAtendimento } from "./_components/controles-atendimento";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "warning"> = {
  higia: "default",
  humano: "warning",
  pausado: "secondary",
};
const STATUS_LABEL: Record<string, string> = {
  higia: "Hígia respondendo",
  humano: "Atendimento humano",
  pausado: "Pausado",
};

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const conversas = await listarConversas();
  const ativaId = c ?? null;
  const data = ativaId ? await obterConversa(ativaId) : null;

  const itens = conversas.map((cv) => ({
    id: cv.id,
    cliente_nome: cv.cliente_nome,
    telefone: cv.telefone,
    status: cv.status,
    nao_lidas: cv.nao_lidas,
    quando: cv.ultima_mensagem_em ? formatarDataHora(cv.ultima_mensagem_em) : "—",
  }));

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <AutoRefresh segundos={8} />

      {/* ESQUERDA: inbox */}
      <aside
        className={cn(
          "flex w-full flex-1 flex-col border-r md:w-[360px] md:flex-none",
          ativaId && "hidden md:flex"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight">Conversas</h1>
            <p className="text-xs text-muted-foreground">Inbox da Hígia</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/configuracoes/whatsapp">
              <Settings2 className="h-4 w-4" /> Conectar
            </Link>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <MessagesSquare className="h-7 w-7" />
              <p>Nenhuma conversa ainda. Elas aparecem quando o WhatsApp estiver conectado.</p>
            </div>
          ) : (
            itens.map((it) => <ListaItem key={it.id} c={it} ativo={it.id === ativaId} />)
          )}
        </div>
      </aside>

      {/* DIREITA: chat aberto */}
      <section className={cn("flex-1 flex-col", ativaId ? "flex" : "hidden md:flex")}>
        {data ? (
          <>
            <header className="flex items-center gap-3 border-b px-4 py-2.5">
              <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Voltar">
                <Link href="/conversas">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{data.cliente?.nome ?? "Cliente"}</p>
                <p className="truncate text-xs text-muted-foreground">{data.cliente?.telefone}</p>
              </div>
              <Badge variant={STATUS_VARIANTE[data.conversa.status] ?? "secondary"}>
                {STATUS_LABEL[data.conversa.status] ?? data.conversa.status}
              </Badge>
            </header>

            <div className="border-b px-4 py-2">
              <ControlesAtendimento id={data.conversa.id} status={data.conversa.status} />
            </div>

            <ChatMensagens
              mensagens={data.mensagens.map((m) => ({
                id: m.id,
                origem: m.origem,
                tipo: m.tipo,
                conteudo: m.conteudo,
                midia_url: m.midia_url,
                quando: formatarDataHora(m.created_at),
              }))}
            />

            <ChatComposer id={data.conversa.id} />
          </>
        ) : ativaId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
            <MessagesSquare className="h-8 w-8" />
            <p>Conversa não encontrada.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/conversas">Voltar à lista</Link>
            </Button>
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground md:flex">
            <MessagesSquare className="h-10 w-10 opacity-40" />
            <p>Selecione uma conversa para ler e responder o cliente por aqui.</p>
          </div>
        )}
      </section>
    </div>
  );
}
