"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarSala, type FormState } from "@/lib/actions/salas";
import type { Sala } from "@/lib/db/schema/salas";
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
      {pending ? "Salvando..." : "Salvar"}
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

export function SalaForm({ sala }: { sala?: Sala }) {
  const [state, action] = useActionState<FormState, FormData>(salvarSala, {});

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {sala ? <input type="hidden" name="id" value={sala.id} /> : null}
      {sala ? (
        <input type="hidden" name="updated_at" value={new Date(sala.updated_at).toISOString()} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome *">
          <Input name="nome" defaultValue={sala?.nome ?? ""} required />
        </Campo>
        <Campo label="Tipo">
          <Input name="tipo" defaultValue={sala?.tipo ?? "privativa"} />
        </Campo>
        <Campo label="Capacidade (pessoas)">
          <Input name="capacidade" type="number" min={1} max={20} defaultValue={sala?.capacidade ?? 3} />
        </Campo>
        <Campo label="Preço/hora (R$)">
          <Input name="preco_hora" type="number" step="0.01" min={0} defaultValue={sala?.preco_hora ?? ""} />
        </Campo>
        <Campo label="Prioridade de alocação">
          <Input
            name="prioridade_alocacao"
            type="number"
            min={0}
            defaultValue={sala?.prioridade_alocacao ?? 0}
          />
        </Campo>
        <Campo label="Ativa">
          <select name="ativa" defaultValue={sala ? String(sala.ativa) : "true"} className={selectClasses}>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </Campo>
      </div>

      <Campo label="Descrição">
        <Textarea name="descricao" defaultValue={sala?.descricao ?? ""} />
      </Campo>

      {state?.erro ? (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Salvar />
        <Button type="button" variant="outline" asChild>
          <Link href="/salas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
