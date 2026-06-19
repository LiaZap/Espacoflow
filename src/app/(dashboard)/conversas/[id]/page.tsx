import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obterConversa } from "@/lib/actions/conversas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversaPainel } from "../_components/conversa-painel";
import { AutoRefresh } from "../_components/auto-refresh";
import { cn, formatarDataHora } from "@/lib/utils";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "warning"> = {
  higia: "default",
  humano: "warning",
  pausado: "secondary",
};

const ROTULO_ORIGEM: Record<string, string> = {
  user: "Cliente",
  higia: "Hígia",
  humano: "Equipe",
};

export default async function ConversaThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await obterConversa(id);
  if (!data) notFound();
  const { conversa, cliente, mensagens } = data;

  return (
    <div className="space-y-4 p-8">
      <AutoRefresh segundos={6} />
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link href="/conversas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">{cliente?.nome ?? "Cliente"}</h1>
          <p className="text-sm text-muted-foreground">{cliente?.telefone}</p>
        </div>
        <Badge variant={STATUS_VARIANTE[conversa.status] ?? "secondary"}>{conversa.status}</Badge>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-4">
        {mensagens.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem mensagens nesta conversa.</p>
        ) : (
          mensagens.map((m) => {
            const doCliente = m.origem === "user";
            return (
              <div key={m.id} className={cn("flex", doCliente ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    doCliente ? "border bg-background" : "bg-primary text-primary-foreground"
                  )}
                >
                  {m.midia_url && m.tipo === "image" ? (
                    <img
                      src={m.midia_url}
                      alt={m.conteudo ?? "imagem"}
                      loading="lazy"
                      className="mb-1 max-h-60 rounded-md"
                    />
                  ) : m.midia_url && m.tipo === "audio" ? (
                    <audio controls src={m.midia_url} className="mb-1 w-[240px] max-w-full" />
                  ) : m.midia_url && (m.tipo === "document" || m.tipo === "video") ? (
                    <a
                      href={m.midia_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-1 block underline"
                    >
                      {m.tipo === "video" ? "Ver vídeo" : (m.conteudo ?? "Abrir documento")}
                    </a>
                  ) : null}
                  {m.conteudo ? (
                    <p className="whitespace-pre-wrap">{m.conteudo}</p>
                  ) : !m.midia_url ? (
                    <p className="italic opacity-70">[{m.tipo}]</p>
                  ) : null}
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      doCliente ? "text-muted-foreground" : "text-primary-foreground/70"
                    )}
                  >
                    {ROTULO_ORIGEM[m.origem] ?? m.origem} • {formatarDataHora(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConversaPainel id={conversa.id} status={conversa.status} />
    </div>
  );
}
