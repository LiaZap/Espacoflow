"use client";

import { useEffect, useRef, useState } from "react";
import { testarHigia, type TesteMsg, type TesteMidia } from "@/lib/actions/agente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bolha = { autor: "voce" | "higia"; texto?: string; midia?: TesteMidia };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => Math.round(ms * (0.85 + Math.random() * 0.3));

/** Renderiza formatação do WhatsApp (*negrito* _itálico_ ~tachado~) de forma segura. */
function formatarWhats(texto: string): string {
  const esc = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~(.+?)~/g, "<del>$1</del>");
}

/** Monta o histórico p/ a API mesclando mensagens consecutivas do mesmo autor. */
function construirHistorico(bolhas: Bolha[]): TesteMsg[] {
  const out: TesteMsg[] = [];
  for (const b of bolhas) {
    const role: TesteMsg["role"] = b.autor === "voce" ? "user" : "assistant";
    const conteudo = b.texto ?? (b.midia ? `[foto enviada: ${b.midia.legenda}]` : "");
    if (!conteudo) continue;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.role === role) ultimo.content += "\n" + conteudo;
    else out.push({ role, content: conteudo });
  }
  return out;
}

/**
 * Chat interno de teste da Hígia. Conversa direto com o agente (prompt/modelo/base
 * reais), sem WhatsApp e sem gravar nada. Simula o ritmo humano ("digitando…" +
 * delay) e mostra as fotos que a Hígia decidir enviar.
 */
export function ChatTeste({ nomeAgente, modelo }: { nomeAgente: string; modelo: string }) {
  const [historico, setHistorico] = useState<Bolha[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historico, digitando]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const msg = texto.trim();
    if (!msg || ocupado) return;

    setErro(null);
    setTexto("");
    const comUsuario: Bolha[] = [...historico, { autor: "voce", texto: msg }];
    setHistorico(comUsuario);
    setOcupado(true);
    setDigitando(true);

    try {
      const r = await testarHigia(construirHistorico(comUsuario));
      if (r.erro || (!r.blocos?.length && !r.midias?.length)) {
        setDigitando(false);
        setErro(r.erro ?? "A Hígia não respondeu.");
        return;
      }

      await sleep(jitter(900)); // "lendo" antes de digitar
      for (const bloco of r.blocos ?? []) {
        setDigitando(true);
        const tempo = Math.min(4000, Math.max(600, (bloco.length / 16) * 1000));
        await sleep(jitter(tempo));
        setDigitando(false);
        setHistorico((h) => [...h, { autor: "higia", texto: bloco }]);
        await sleep(jitter(450));
      }
      for (const midia of r.midias ?? []) {
        setDigitando(true);
        await sleep(jitter(1100)); // tempo de "enviar a foto"
        setDigitando(false);
        setHistorico((h) => [...h, { autor: "higia", midia }]);
        await sleep(jitter(450));
      }
    } catch (err) {
      setErro(String(err));
    } finally {
      setDigitando(false);
      setOcupado(false);
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
              if (ocupado) return;
              setHistorico([]);
              setErro(null);
            }}
          >
            Limpar
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-4">
        {historico.length === 0 && !digitando ? (
          <p className="mx-auto mt-8 max-w-sm text-center text-sm text-muted-foreground">
            Mande uma mensagem como se fosse um cliente no WhatsApp.
            <br />
            Ex: <span className="italic">“Oi, queria ver as salas”</span> (ela pode mandar fotos).
          </p>
        ) : null}

        {historico.map((b, i) => {
          if (b.autor === "voce") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {b.texto}
                </div>
              </div>
            );
          }
          if (b.midia) {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[70%] overflow-hidden rounded-2xl rounded-bl-sm bg-muted p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.midia.url}
                    alt={b.midia.nome}
                    className="max-h-64 w-full rounded-xl object-cover"
                  />
                  {b.midia.legenda ? (
                    <p className="px-2 py-1.5 text-sm">{b.midia.legenda}</p>
                  ) : null}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start">
              <div
                className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: formatarWhats(b.texto ?? "") }}
              />
            </div>
          );
        })}

        {digitando ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" />
            </div>
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
          disabled={ocupado}
          autoComplete="off"
        />
        <Button type="submit" disabled={ocupado || !texto.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
