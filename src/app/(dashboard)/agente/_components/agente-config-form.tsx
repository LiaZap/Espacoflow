"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarConfig, type FormState } from "@/lib/actions/agente";
import type { AgenteConfig } from "@/lib/db/schema/agente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar configuração"}
    </Button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function AgenteConfigForm({ config }: { config: AgenteConfig }) {
  const [state, action] = useActionState<FormState, FormData>(salvarConfig, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={config.id} />
      <input type="hidden" name="updated_at" value={new Date(config.updated_at).toISOString()} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome do espaço">
          <Input name="nome_espaco" defaultValue={config.nome_espaco} />
        </Campo>
        <Campo label="Nome do agente">
          <Input name="nome_agente" defaultValue={config.nome_agente} />
        </Campo>
        <Campo label="Modelo de IA">
          <Input name="modelo_ia" defaultValue={config.modelo_ia} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Abre às">
            <Input name="hora_inicio" type="time" defaultValue={config.hora_inicio?.slice(0, 5) ?? ""} />
          </Campo>
          <Campo label="Fecha às">
            <Input name="hora_fim" type="time" defaultValue={config.hora_fim?.slice(0, 5) ?? ""} />
          </Campo>
        </div>
        <Campo label="Resposta automática">
          <select name="resposta_automatica" defaultValue={String(config.resposta_automatica)} className={selectClasses}>
            <option value="true">Ativada</option>
            <option value="false">Desativada</option>
          </select>
        </Campo>
        <Campo label="Permitir reserva via IA">
          <select name="reserva_via_ia" defaultValue={String(config.reserva_via_ia)} className={selectClasses}>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </Campo>
      </div>

      <Campo label="Prompt-base / persona (deixe vazio para usar o padrão da Hígia)">
        <Textarea name="prompt_sistema" rows={6} defaultValue={config.prompt_sistema ?? ""} />
      </Campo>

      {state?.erro ? (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success">Configuração salva.</p> : null}

      <Salvar />
    </form>
  );
}
