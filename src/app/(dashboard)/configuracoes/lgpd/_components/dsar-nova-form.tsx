"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { criarSolicitacao, type FormState } from "@/lib/actions/lgpd";
import { TIPOS_DSAR } from "@/lib/validators/lgpd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Registrar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Registrando…" : "Registrar solicitação"}
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

export function DsarNovaForm() {
  const [state, action] = useActionState<FormState, FormData>(criarSolicitacao, {});
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Solicitação registrada.");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nome do solicitante *">
          <Input name="nome_solicitante" required />
        </Campo>
        <Campo label="E-mail">
          <Input name="email_solicitante" type="email" />
        </Campo>
        <Campo label="Telefone">
          <Input name="telefone_solicitante" />
        </Campo>
        <Campo label="Tipo *">
          <select name="tipo" className={selectClasses} defaultValue="acesso">
            {TIPOS_DSAR.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Prioridade">
          <select name="prioridade" className={selectClasses} defaultValue="normal">
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>
        </Campo>
      </div>
      <Campo label="Descrição">
        <Textarea name="descricao" placeholder="Detalhes da solicitação do titular…" />
      </Campo>
      {state?.erro ? <p className="text-sm text-destructive">{state.erro}</p> : null}
      <Registrar />
    </form>
  );
}
