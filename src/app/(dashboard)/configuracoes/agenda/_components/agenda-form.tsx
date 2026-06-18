"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  salvarAgendaConfig,
  desconectarAgenda,
  type AgendaFormState,
} from "@/lib/actions/google-agenda";
import type { GoogleAgendaConfig } from "@/lib/db/schema/integracoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar"}
    </Button>
  );
}

export function AgendaForm({ config }: { config: GoogleAgendaConfig }) {
  const [state, action] = useActionState<AgendaFormState, FormData>(salvarAgendaConfig, {});
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function desconectar() {
    if (!window.confirm("Desconectar o Google Agenda? Será preciso conectar de novo para sincronizar.")) return;
    setErro(null);
    startTransition(async () => {
      const r = await desconectarAgenda();
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={config.id} />

      <div className="space-y-1.5">
        <Label>ID da agenda</Label>
        <Input
          name="calendar_id"
          defaultValue={config.calendar_id}
          placeholder="primary (ou o e-mail/ID da agenda específica)"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Sincronizar reservas</Label>
        <select name="sincronizar" defaultValue={String(config.sincronizar)} className={selectClasses}>
          <option value="true">Ativada</option>
          <option value="false">Desativada</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Quando ativa e conectada, as reservas confirmadas viram eventos na agenda.
        </p>
      </div>

      {state?.erro ? (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success">Configuração salva.</p> : null}
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Salvar />
        {config.conectado ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pendente}
            onClick={desconectar}
            className="text-destructive hover:text-destructive"
          >
            Desconectar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
