"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  criarMidia,
  alternarMidia,
  excluirMidia,
  importarFotosSalas,
  type MidiaFormState,
} from "@/lib/actions/agente-midia";
import type { AgenteMidia } from "@/lib/db/schema/agente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Identificador estável usado no marcador [FOTO: x] (espelha slugMidia do servidor). */
function ident(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ehImagem(tipo: string): boolean {
  return tipo?.startsWith("image/");
}

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Adicionar mídia"}
    </Button>
  );
}

export function MidiaManager({ midias }: { midias: AgenteMidia[] }) {
  const [state, action] = useActionState<MidiaFormState, FormData>(criarMidia, {});
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  function toggle(m: AgenteMidia) {
    setErro(null);
    startTransition(async () => {
      const r = await alternarMidia(m.id, !m.ativo);
      if (r.erro) setErro(r.erro);
    });
  }

  function remover(m: AgenteMidia) {
    if (!window.confirm(`Remover "${m.nome}"? A Hígia deixa de enviar este arquivo.`)) return;
    setErro(null);
    startTransition(async () => {
      const r = await excluirMidia(m.id);
      if (r.erro) setErro(r.erro);
    });
  }

  function importar() {
    setErro(null);
    startTransition(async () => {
      const r = await importarFotosSalas();
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <div className="space-y-6">
      {/* Atalho: importa as fotos das salas que já vêm no app */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground">
          Quer começar rápido? Importe as fotos das salas que já vêm com o sistema.
        </p>
        <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={importar}>
          {pendente ? "Importando…" : "Importar fotos das salas"}
        </Button>
      </div>

      {/* Upload */}
      <form ref={formRef} action={action} className="space-y-4 rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input name="nome" placeholder="Ex: Sala Privativa 01" required />
          </div>
          <div className="space-y-1.5">
            <Label>Identificador (para a IA)</Label>
            <Input name="tags" placeholder="Ex: sala-01" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição / legenda</Label>
          <Textarea
            name="descricao"
            rows={2}
            placeholder="Vai como legenda da foto no WhatsApp. Ex: Sala privativa para atendimento individual."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Arquivo (JPG, PNG, WEBP, GIF ou PDF — até 8 MB)</Label>
          <Input name="arquivo" type="file" accept="image/*,application/pdf" required />
        </div>

        {state?.erro ? (
          <p className="text-sm text-destructive" role="alert">
            {state.erro}
          </p>
        ) : null}
        {state?.ok ? <p className="text-sm text-success">Mídia adicionada.</p> : null}

        <Enviar />
      </form>

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      {/* Lista */}
      {midias.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma mídia ainda. Adicione as fotos das salas acima — depois a Hígia poderá enviá-las no atendimento.
        </p>
      ) : (
        <ul className="space-y-3">
          {midias.map((m) => (
            <li
              key={m.id}
              className={`flex items-center gap-4 rounded-md border p-3 ${m.ativo ? "" : "opacity-60"}`}
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {ehImagem(m.tipo_arquivo) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.arquivo_url} alt={m.nome} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                    PDF
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  marcador: <code className="font-mono">[FOTO: {ident(m.tags || m.nome)}]</code>
                </p>
                {m.descricao ? (
                  <p className="truncate text-xs text-muted-foreground">{m.descricao}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => toggle(m)}>
                  {m.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendente}
                  onClick={() => remover(m)}
                  className="text-destructive hover:text-destructive"
                >
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
