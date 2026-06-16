"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModalConfirmacaoBlock } from "@/components/modal-confirmacao-block";

interface ExcluirBotaoProps {
  acao: (id: string) => Promise<{ erro?: string } | void>;
  id: string;
  titulo: string;
  resumo?: React.ReactNode;
}

/** Botão de exclusão (soft delete) com modal de confirmação block 3s. */
export function ExcluirBotao({ acao, id, titulo, resumo }: ExcluirBotaoProps) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const r = await acao(id);
      if (r && "erro" in r && r.erro) {
        toast.error(r.erro);
      } else {
        toast.success("Registro excluído.");
        setAberto(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setAberto(true)}
        aria-label="Excluir"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <ModalConfirmacaoBlock
        aberto={aberto}
        titulo={titulo}
        descricao="Esta ação faz exclusão lógica (soft delete) e pode ser auditada."
        resumo={resumo}
        variante="destructive"
        textoConfirmar="Excluir"
        carregando={pendente}
        onConfirmar={confirmar}
        onCancelar={() => setAberto(false)}
      />
    </>
  );
}
