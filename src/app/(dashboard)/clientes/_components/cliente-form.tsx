"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarCliente, type FormState } from "@/lib/actions/clientes";
import type { Cliente } from "@/lib/db/schema/clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUS: Array<[string, string]> = [
  ["novo", "Novo"],
  ["qualificando", "Qualificando"],
  ["apto", "Apto"],
  ["fora_perfil", "Fora de perfil"],
  ["cliente", "Cliente"],
  ["inativo", "Inativo"],
];

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

export function ClienteForm({
  cliente,
  titulares = [],
}: {
  cliente?: Cliente;
  /** Clientes que podem ser TITULAR do saldo (empresa com mais de um contato autorizado). */
  titulares?: Array<{ id: string; nome: string; telefone: string }>;
}) {
  const [state, action] = useActionState<FormState, FormData>(salvarCliente, {});

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}
      {cliente ? (
        <input type="hidden" name="updated_at" value={new Date(cliente.updated_at).toISOString()} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome *">
          <Input name="nome" defaultValue={cliente?.nome ?? ""} required />
        </Campo>
        <Campo label="Como chamar">
          <Input name="nome_chamada" defaultValue={cliente?.nome_chamada ?? ""} />
        </Campo>
        <Campo label="Telefone * (WhatsApp)">
          <Input name="telefone" defaultValue={cliente?.telefone ?? ""} required placeholder="61999999999" />
        </Campo>
        <Campo label="E-mail">
          <Input name="email" type="email" defaultValue={cliente?.email ?? ""} />
        </Campo>
        <Campo label="Documento">
          <Input name="documento" defaultValue={cliente?.documento ?? ""} />
        </Campo>
        <Campo label="Status">
          <select name="status_lead" defaultValue={cliente?.status_lead ?? "novo"} className={selectClasses}>
            {STATUS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Origem">
          <Input name="origem" defaultValue={cliente?.origem ?? ""} placeholder="WhatsApp, indicação..." />
        </Campo>
        <Campo label="Score de qualificação (0-100)">
          <Input
            name="qualification_score"
            type="number"
            min={0}
            max={100}
            defaultValue={cliente?.qualification_score ?? ""}
          />
        </Campo>
      </div>

      <Campo label="Saldo compartilhado com (opcional)">
        <select name="titular_id" className={selectClasses} defaultValue={cliente?.titular_id ?? ""}>
          <option value="">Não compartilha (usa o próprio saldo)</option>
          {titulares
            .filter((t) => t.id !== cliente?.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} — {t.telefone}
              </option>
            ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Empresa com mais de um contato autorizado: escolha o cliente TITULAR. Este contato passa a consumir o pacote e
          o crédito do titular (saldo único), e cada reserva fica registrada em quem reservou.
        </p>
      </Campo>

      <Campo label="Perfil de sala (opcional)">
        <Input
          name="sala_preferida"
          placeholder="Ex: Sala 02"
          defaultValue={cliente?.sala_preferida ?? ""}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Se preenchido, a Hígia oferece essa sala primeiro quando estiver livre (respeita o perfil do cliente).
        </p>
      </Campo>

      <Campo label="Interesses">
        <Textarea name="interesses" defaultValue={cliente?.interesses ?? ""} />
      </Campo>
      <Campo label="Dores / necessidades">
        <Textarea name="dores" defaultValue={cliente?.dores ?? ""} />
      </Campo>

      {state?.erro ? (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Salvar />
        <Button type="button" variant="outline" asChild>
          <Link href="/clientes">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
