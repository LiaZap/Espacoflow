"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { concederCreditoManual, type FormState } from "@/lib/actions/pacotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface OpcaoCliente {
  id: string;
  nome: string;
  telefone: string;
}

function Conceder() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Concedendo..." : "Conceder crédito"}
    </Button>
  );
}

export function ConcederCreditoForm({ clientes }: { clientes: OpcaoCliente[] }) {
  const [state, action] = useActionState<FormState, FormData>(concederCreditoManual, {});

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
      <div className="w-[140px] space-y-1.5">
        <Label>Valor (R$)</Label>
        <Input name="valor" inputMode="decimal" placeholder="Ex: 65,00" required />
      </div>
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label>Motivo (opcional)</Label>
        <Input name="motivo" placeholder="Ex: cortesia por cancelamento" />
      </div>
      <Conceder />
      {state?.erro ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}
      {state?.ok ? <p className="w-full text-sm text-success">Crédito concedido ao cliente.</p> : null}
    </form>
  );
}
