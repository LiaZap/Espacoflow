"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, UserX } from "lucide-react";
import { alterarPapel, redefinirSenha, desativarUsuario } from "@/lib/actions/usuarios";
import type { Role } from "@/lib/auth/rbac";

const selectClasses =
  "rounded-md border border-input bg-card px-2 py-1 text-xs disabled:opacity-50";

export function UsuarioAcoes({
  id,
  role,
  nome,
  papeis,
  podeExcluir,
  ehVoceMesmo,
}: {
  id: string;
  role: string;
  nome: string;
  papeis: Array<{ value: string; label: string }>;
  podeExcluir: boolean;
  ehVoceMesmo: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function mudarPapel(novo: string) {
    if (novo === role) return;
    iniciar(async () => {
      const r = await alterarPapel(id, novo as Role);
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success("Papel atualizado.");
        router.refresh();
      }
    });
  }

  function resetar() {
    const senha = window.prompt(`Nova senha provisória para ${nome} (mín. 8 caracteres):`);
    if (!senha) return;
    iniciar(async () => {
      const r = await redefinirSenha(id, senha);
      if (r?.erro) toast.error(r.erro);
      else toast.success("Senha redefinida.");
    });
  }

  function desativar() {
    if (!window.confirm(`Desativar o acesso de ${nome}? A conta deixará de poder entrar.`)) return;
    iniciar(async () => {
      const r = await desativarUsuario(id);
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success("Usuário desativado.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        aria-label="Papel"
        disabled={pendente}
        defaultValue={role}
        onChange={(e) => mudarPapel(e.target.value)}
        className={selectClasses}
      >
        {papeis.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pendente}
        onClick={resetar}
        title="Redefinir senha"
        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        <KeyRound className="h-3.5 w-3.5" /> Senha
      </button>
      {podeExcluir && !ehVoceMesmo ? (
        <button
          type="button"
          disabled={pendente}
          onClick={desativar}
          title="Desativar usuário"
          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          <UserX className="h-3.5 w-3.5" /> Desativar
        </button>
      ) : null}
    </div>
  );
}
