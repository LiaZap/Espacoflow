"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { venderPacote, type FormState } from "@/lib/actions/pacotes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface OpcaoCliente {
  id: string;
  nome: string;
  telefone: string;
}
interface OpcaoPacote {
  id: string;
  nome: string;
}

function Vender() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Processando..." : "Vender (gera PIX pendente)"}
    </Button>
  );
}

export function VenderPacoteForm({
  clientes,
  pacotes,
}: {
  clientes: OpcaoCliente[];
  pacotes: OpcaoPacote[];
}) {
  const [state, action] = useActionState<FormState, FormData>(venderPacote, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <Label>Cliente</Label>
        <select name="cliente_id" required className={selectClasses} defaultValue="">
          <option value="">Selecione…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} — {c.telefone}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <Label>Pacote</Label>
        <select name="pacote_id" required className={selectClasses} defaultValue="">
          <option value="">Selecione…</option>
          {pacotes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <Vender />
      {state?.erro ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}
    </form>
  );
}
