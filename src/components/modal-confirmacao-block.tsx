"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ModalConfirmacaoBlockProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  /** Resumo claro do que vai acontecer (obrigatório para ações críticas). */
  resumo?: React.ReactNode;
  textoConfirmar?: string;
  variante?: "default" | "destructive" | "success";
  /** Segundos de bloqueio antes de liberar os botões (regra da base: 3s). */
  segundosBloqueio?: number;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Modal de confirmação para AÇÕES CRÍTICAS (salvar lançamento, excluir, validar Pix).
 * Bloqueia a tela por N segundos: durante o bloqueio não fecha por ESC, clique-fora
 * nem libera os botões. Mostra um resumo do que vai acontecer. (CLAUDE.md / components.md)
 */
export function ModalConfirmacaoBlock({
  aberto,
  titulo,
  descricao,
  resumo,
  textoConfirmar = "Confirmar",
  variante = "default",
  segundosBloqueio = 3,
  carregando = false,
  onConfirmar,
  onCancelar,
}: ModalConfirmacaoBlockProps) {
  const [restante, setRestante] = useState(segundosBloqueio);

  useEffect(() => {
    if (!aberto) {
      setRestante(segundosBloqueio);
      return;
    }
    setRestante(segundosBloqueio);
    const inicio = Date.now();
    const id = setInterval(() => {
      const passado = Math.floor((Date.now() - inicio) / 1000);
      const r = Math.max(0, segundosBloqueio - passado);
      setRestante(r);
      if (r === 0) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [aberto, segundosBloqueio]);

  const bloqueado = restante > 0;
  const travado = bloqueado || carregando;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o && !travado) onCancelar();
      }}
    >
      <DialogContent
        hideClose={travado}
        onEscapeKeyDown={(e) => {
          if (travado) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (travado) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (travado) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : null}
        </DialogHeader>

        {resumo ? (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">{resumo}</div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancelar} disabled={travado}>
            Cancelar
          </Button>
          <Button variant={variante} onClick={onConfirmar} disabled={travado}>
            {bloqueado
              ? `Aguarde ${restante}s`
              : carregando
                ? "Processando..."
                : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
