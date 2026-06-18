"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { concluirReserva, marcarNoShow } from "@/lib/actions/reservas";
import { Button } from "@/components/ui/button";

/** Check-in: marca a reserva como "compareceu" (concluída) ou "faltou" (no_show). */
export function CheckinBotoes({ id, status }: { id: string; status: string }) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function acao(fn: (id: string) => Promise<{ erro?: string }>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn(id);
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pendente}
        aria-label="Marcar como compareceu"
        title="Compareceu"
        onClick={() => acao(concluirReserva)}
        className={status === "concluida" ? "text-success" : "text-muted-foreground"}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pendente}
        aria-label="Marcar como faltou"
        title="Faltou (no-show)"
        onClick={() => acao(marcarNoShow)}
        className={status === "no_show" ? "text-destructive" : "text-muted-foreground"}
      >
        <X className="h-4 w-4" />
      </Button>
      {erro ? <span className="ml-1 text-xs text-destructive">{erro}</span> : null}
    </>
  );
}
