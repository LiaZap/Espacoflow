"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ajustarSaldoManual, type FormState } from "@/lib/actions/pacotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface OpcaoSaldo {
  id: string;
  cliente_nome: string;
  pacote_nome: string;
  horas_saldo: string;
}

function Ajustar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Ajustando..." : "Ajustar saldo"}
    </Button>
  );
}

export function AjustarSaldoForm({ saldos }: { saldos: OpcaoSaldo[] }) {
  const [state, action] = useActionState<FormState, FormData>(ajustarSaldoManual, {});

  if (saldos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum saldo ativo para ajustar.</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1 space-y-1.5">
        <Label>Saldo (cliente / pacote)</Label>
        <select name="cliente_pacote_id" required className={selectClasses} defaultValue="">
          <option value="">Selecione…</option>
          {saldos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.cliente_nome} — {s.pacote_nome} ({s.horas_saldo}h)
            </option>
          ))}
        </select>
      </div>
      <div className="w-[130px] space-y-1.5">
        <Label>Horas (+/-)</Label>
        <Input name="horas" inputMode="decimal" placeholder="Ex: -5" required />
      </div>
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label>Motivo</Label>
        <Input name="motivo" placeholder="Ex: 5h usadas no atendimento humano (12/07)" required />
      </div>
      <Ajustar />
      {state?.erro ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}
      {state?.ok ? <p className="w-full text-sm text-success">Saldo ajustado — veja o extrato na seta do saldo.</p> : null}
    </form>
  );
}
