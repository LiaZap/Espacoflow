"use client";

import { useEffect, useRef, useState } from "react";
import { testarHigia, type TesteMsg } from "@/lib/actions/agente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bolha = { autor: "voce" | "higia"; blocos: string[] };

/**
 * Chat interno de teste da Hígia. Conversa direto com o agente (prompt/modelo/base
 * reais), sem WhatsApp e sem gravar nada — só para validar o atendimento.
 */
export function ChatTeste({ nomeAgente, modelo }: { nomeAgente: string; modelo: string }) {
  const [historico, setHistorico] = useState<Bolha[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historico, carregando]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const msg = texto.trim();
    if (!msg || carregando) return;

    setErro(null);
    setTexto("");
    const comUsuario: Bolha[] = [...historico, { autor: "voce", blocos: [msg] }];
    setHistorico(comUsuario);
    setCarregando(true);

    const apiHist: TesteMsg[] = comUsuario.map((b) => ({
      role: b.autor === "voce" ? "user" : "assistant",
      content: b.blocos.join("\n"),
    }));

    try {
      const r = await testarHigia(apiHist);
      if (r.erro) setErro(r.erro);
      else if (r.blocos?.length) {
        setHistorico((h) => [...h, { autor: "higia", blocos: r.blocos! }]);
      }
    } catch (err) {
      setErro(String(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
        <span>
          Teste com a {nomeAgente} · modelo <code className="font-mono">{modelo}</code> · não grava nem envia
        </span>
        {historico.length > 0 ? (
          <button
            type="button"
            className="rounded px-2 py-0.5 hover:bg-muted hover:text-foreground"
            onClick={() => {
              setHistorico([]);
              setErro(null);
            }}
          >
            Limpar
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {historico.length === 0 && !carregando ? (
          <p className="mx-auto mt-8 max-w-sm text-center text-sm text-muted-foreground">
            Mande uma mensagem como se fosse um cliente no WhatsApp.
            <br />
            Ex: <span className="italic">“Oi, queria saber sobre as salas privativas”</span>.
          </p>
        ) : null}

        {historico.map((b, i) => (
          <div
            key={i}
            className={b.autor === "voce" ? "flex flex-col items-end gap-1" : "flex flex-col items-start gap-1"}
          >
            {b.blocos.map((bloco, j) => (
              <div
                key={j}
                className={
                  b.autor === "voce"
                    ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm"
                }
              >
                {bloco}
              </div>
            ))}
          </div>
        ))}

        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-pulse">{nomeAgente} está digitando…</span>
          </div>
        ) : null}

        <div ref={fimRef} />
      </div>

      {erro ? (
        <p className="border-t bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <form onSubmit={enviar} className="flex gap-2 border-t p-3">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva como um cliente…"
          disabled={carregando}
          autoComplete="off"
        />
        <Button type="submit" disabled={carregando || !texto.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
