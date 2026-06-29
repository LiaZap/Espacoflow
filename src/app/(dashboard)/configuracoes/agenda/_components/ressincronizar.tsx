"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ressincronizarReservasGoogle } from "@/lib/actions/google-agenda";
import { Button } from "@/components/ui/button";

/** Re-empurra as reservas confirmadas futuras para o Google. Mostra o motivo se o gate falhar. */
export function Ressincronizar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function rodar() {
    iniciar(async () => {
      const r = await ressincronizarReservasGoogle();
      if (r.erro) toast.error(r.erro);
      else {
        toast.success(`Sincronizadas ${r.sincronizadas ?? 0} de ${r.total ?? 0} reserva(s) confirmada(s).`);
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pendente} onClick={rodar}>
      <RefreshCw className="h-4 w-4" /> {pendente ? "Sincronizando…" : "Ressincronizar reservas no Google"}
    </Button>
  );
}
