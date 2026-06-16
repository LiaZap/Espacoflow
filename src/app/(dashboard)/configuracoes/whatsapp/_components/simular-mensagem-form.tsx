"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { simularMensagemRecebida, type FormState } from "@/lib/actions/conversas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Simular recebida"}
    </Button>
  );
}

export function SimularMensagemForm() {
  const [state, action] = useActionState<FormState, FormData>(simularMensagemRecebida, {});
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Mensagem simulada. Veja em Conversas.");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input name="telefone" placeholder="61999999999" required />
        </div>
        <div className="space-y-1.5">
          <Label>Nome (opcional)</Label>
          <Input name="nome" placeholder="Maria" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <select
            name="tipo"
            defaultValue="text"
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="text">Texto</option>
            <option value="image">Imagem</option>
            <option value="audio">Áudio</option>
            <option value="document">Documento</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>URL da mídia (se não for texto)</Label>
          <Input name="midia_url" placeholder="https://…/foto.jpg" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Mensagem / legenda</Label>
        <Textarea name="texto" placeholder="Oi, queria saber sobre as salas privativas." />
      </div>
      {state?.erro ? <p className="text-sm text-destructive">{state.erro}</p> : null}
      <Enviar />
    </form>
  );
}
