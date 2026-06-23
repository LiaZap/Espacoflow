"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Hand, Pause } from "lucide-react";
import { definirStatusConversa } from "@/lib/actions/conversas";
import { Button } from "@/components/ui/button";

type Status = "higia" | "humano" | "pausado";

/** Botões de controle do atendimento (no cabeçalho do chat). */
export function ControlesAtendimento({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [mudando, iniciar] = useTransition();

  function mudar(s: Status) {
    iniciar(async () => {
      const r = await definirStatusConversa(id, s);
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success(
          s === "higia" ? "Conversa devolvida à Hígia." : s === "humano" ? "Você assumiu a conversa." : "Conversa pausada."
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant={status === "humano" ? "default" : "outline"} disabled={mudando} onClick={() => mudar("humano")}>
        <Hand className="h-3.5 w-3.5" /> Assumir
      </Button>
      <Button size="sm" variant={status === "higia" ? "default" : "outline"} disabled={mudando} onClick={() => mudar("higia")}>
        <Bot className="h-3.5 w-3.5" /> Devolver à Hígia
      </Button>
      <Button size="sm" variant={status === "pausado" ? "default" : "outline"} disabled={mudando} onClick={() => mudar("pausado")}>
        <Pause className="h-3.5 w-3.5" /> Pausar
      </Button>
    </div>
  );
}
