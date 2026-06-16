"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { validarPagamento } from "@/lib/actions/pagamentos";
import { Button } from "@/components/ui/button";
import { ModalConfirmacaoBlock } from "@/components/modal-confirmacao-block";

type Acao = "confirmado" | "recusado";

export function ValidarPixBotoes({ id, resumo }: { id: string; resumo: React.ReactNode }) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    if (!acao) return;
    iniciar(async () => {
      const r = await validarPagamento(id, acao);
      if (r?.erro) {
        toast.error(r.erro);
      } else {
        toast.success(acao === "confirmado" ? "Pagamento confirmado." : "Pagamento recusado.");
        setAcao(null);
      }
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="success" onClick={() => setAcao("confirmado")}>
          Confirmar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAcao("recusado")}>
          Recusar
        </Button>
      </div>
      <ModalConfirmacaoBlock
        aberto={acao !== null}
        titulo={acao === "recusado" ? "Recusar pagamento?" : "Confirmar pagamento PIX?"}
        descricao="Validação manual do comprovante. Esta ação é registrada na auditoria."
        resumo={resumo}
        variante={acao === "recusado" ? "destructive" : "success"}
        textoConfirmar={acao === "recusado" ? "Recusar" : "Confirmar"}
        carregando={pendente}
        onConfirmar={confirmar}
        onCancelar={() => setAcao(null)}
      />
    </>
  );
}
