"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ChatMsg {
  id: string;
  origem: string;
  tipo: string;
  conteudo: string | null;
  midia_url: string | null;
  quando: string;
}

const ROTULO_ORIGEM: Record<string, string> = {
  user: "Cliente",
  higia: "Hígia",
  humano: "Equipe",
};

/** Lista de mensagens estilo chat, com rolagem automática para a última. */
export function ChatMensagens({ mensagens }: { mensagens: ChatMsg[] }) {
  const fimRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  if (mensagens.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Sem mensagens nesta conversa ainda.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-4">
      {mensagens.map((m) => {
        const doCliente = m.origem === "user";
        return (
          <div key={m.id} className={cn("flex", doCliente ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                doCliente
                  ? "rounded-bl-sm border bg-background"
                  : m.origem === "higia"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-br-sm bg-accent text-accent-foreground"
              )}
            >
              {m.midia_url && m.tipo === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.midia_url}
                  alt={m.conteudo ?? "imagem"}
                  loading="lazy"
                  className="mb-1 max-h-60 rounded-md"
                />
              ) : m.midia_url && m.tipo === "audio" ? (
                <audio controls src={m.midia_url} className="mb-1 w-[240px] max-w-full" />
              ) : m.midia_url && (m.tipo === "document" || m.tipo === "video") ? (
                <a href={m.midia_url} target="_blank" rel="noreferrer" className="mb-1 block underline">
                  {m.tipo === "video" ? "Ver vídeo" : (m.conteudo ?? "Abrir documento")}
                </a>
              ) : null}
              {m.conteudo ? (
                <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
              ) : !m.midia_url ? (
                <p className="italic opacity-70">[{m.tipo}]</p>
              ) : null}
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  doCliente ? "text-muted-foreground" : "opacity-70"
                )}
              >
                {ROTULO_ORIGEM[m.origem] ?? m.origem} • {m.quando}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={fimRef} />
    </div>
  );
}
