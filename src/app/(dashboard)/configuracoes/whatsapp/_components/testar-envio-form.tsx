"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { testarEnvio, type FormState } from "@/lib/actions/conversas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Enviar teste"}
    </Button>
  );
}

export function TestarEnvioForm() {
  const [state, action] = useActionState<FormState, FormData>(testarEnvio, {});

  useEffect(() => {
    if (state?.ok) toast.success("Envio disparado (veja o log do provedor/sandbox).");
    else if (state?.erro) toast.error(state.erro);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label>Telefone</Label>
        <Input name="telefone" placeholder="61999999999" required />
      </div>
      <div className="min-w-[220px] flex-[2] space-y-1.5">
        <Label>Texto</Label>
        <Input name="texto" placeholder="Mensagem de teste do Espaço Flow." />
      </div>
      <Enviar />
    </form>
  );
}
