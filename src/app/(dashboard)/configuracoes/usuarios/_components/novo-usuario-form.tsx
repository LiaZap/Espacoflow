"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { criarUsuario, type FormState } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NovoUsuarioForm({ papeis }: { papeis: Array<{ value: string; label: string }> }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pendente] = useActionState<FormState, FormData>(criarUsuario, {});

  useEffect(() => {
    if (state.ok) {
      toast.success("Usuário criado.");
      formRef.current?.reset();
      router.refresh();
    } else if (state.erro) {
      toast.error(state.erro);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required placeholder="Nome completo" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required placeholder="pessoa@espacoflow.com.br" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        <select id="role" name="role" required defaultValue="recepcao" className={selectClasses}>
          {papeis.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha provisória</Label>
        <Input id="senha" name="senha" type="text" required minLength={8} placeholder="mín. 8 caracteres" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Criando..." : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
