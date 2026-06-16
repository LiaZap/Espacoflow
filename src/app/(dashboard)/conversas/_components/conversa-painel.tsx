"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { enviarMensagemManual, definirStatusConversa } from "@/lib/actions/conversas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Status = "higia" | "humano" | "pausado";

export function ConversaPainel({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, iniciarEnvio] = useTransition();
  const [mudando, iniciarStatus] = useTransition();

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    iniciarEnvio(async () => {
      const r = await enviarMensagemManual(id, t);
      if (r?.erro) {
        toast.error(r.erro);
      } else {
        setTexto("");
        toast.success("Mensagem enviada.");
        router.refresh();
      }
    });
  }

  function mudarStatus(s: Status) {
    iniciarStatus(async () => {
      const r = await definirStatusConversa(id, s);
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success("Atendimento atualizado.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={status === "humano" ? "default" : "outline"} disabled={mudando} onClick={() => mudarStatus("humano")}>
          Assumir (humano)
        </Button>
        <Button size="sm" variant={status === "higia" ? "default" : "outline"} disabled={mudando} onClick={() => mudarStatus("higia")}>
          Devolver à Hígia
        </Button>
        <Button size="sm" variant={status === "pausado" ? "default" : "outline"} disabled={mudando} onClick={() => mudarStatus("pausado")}>
          Pausar
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma resposta…"
          rows={2}
          className="flex-1"
        />
        <Button onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
