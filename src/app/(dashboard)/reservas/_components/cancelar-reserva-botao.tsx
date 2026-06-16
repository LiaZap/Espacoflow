"use client";

import { useState, useTransition } from "react";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import { cancelarReserva } from "@/lib/actions/reservas";
import { Button } from "@/components/ui/button";
import { ModalConfirmacaoBlock } from "@/components/modal-confirmacao-block";

export function CancelarReservaBotao({ id, resumo }: { id: string; resumo: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const r = await cancelarReserva(id);
      if (r?.erro) {
        toast.error(r.erro);
      } else {
        toast.success("Reserva cancelada.");
        setAberto(false);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(true)}>
        <XCircle className="h-4 w-4 text-destructive" /> Cancelar
      </Button>
      <ModalConfirmacaoBlock
        aberto={aberto}
        titulo="Cancelar reserva?"
        descricao="Cancelamento com 12h+ de antecedência vira crédito de horas (política vigente)."
        resumo={resumo}
        variante="destructive"
        textoConfirmar="Cancelar reserva"
        carregando={pendente}
        onConfirmar={confirmar}
        onCancelar={() => setAberto(false)}
      />
    </>
  );
}
