"use client";

import { useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { emitirReciboPagamento } from "@/lib/actions/pagamentos";
import { Button } from "@/components/ui/button";

export function ReciboBotao({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();

  function emitir() {
    iniciar(async () => {
      const r = await emitirReciboPagamento(id);
      if (r?.erro) toast.error(r.erro);
      else if (r.url) {
        toast.success("Recibo gerado.");
        window.open(r.url, "_blank");
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={emitir}>
      <FileText className="h-4 w-4" /> {pendente ? "Gerando…" : "Recibo"}
    </Button>
  );
}
