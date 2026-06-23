"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { definirStatusConversa } from "@/lib/actions/conversas";

/**
 * Atalho na lista de conversas: devolve a conversa para a Hígia sem precisar
 * abrir o thread. Aparece quando o atendimento está em "humano" ou "pausado".
 */
export function BotaoDevolverHigia({ id }: { id: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function devolver(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    iniciar(async () => {
      const r = await definirStatusConversa(id, "higia");
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success("Conversa devolvida à Hígia.");
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pendente}
      onClick={devolver}
      title="Devolver esta conversa para a Hígia"
      className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      <Bot className="h-3.5 w-3.5" />
      {pendente ? "Devolvendo…" : "Devolver à Hígia"}
    </button>
  );
}
