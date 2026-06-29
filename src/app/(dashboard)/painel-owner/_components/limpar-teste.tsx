"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { limparDadosTesteWhatsapp } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

/** Limpa os contatos de teste (WhatsApp) e tudo ligado. Só owner. Pede confirmação. */
export function LimparTeste() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function limpar() {
    if (
      !window.confirm(
        "Apagar TODOS os contatos que entraram pelo WhatsApp e tudo ligado a eles (conversas, reservas, pagamentos)? Use só para reiniciar os testes. É reversível no banco, mas some das telas."
      )
    )
      return;
    iniciar(async () => {
      const r = await limparDadosTesteWhatsapp();
      if (r.erro) toast.error(r.erro);
      else {
        toast.success(`Limpeza concluída: ${r.total ?? 0} contato(s) de teste removido(s).`);
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pendente} onClick={limpar} className="text-destructive">
      <Trash2 className="h-4 w-4" /> {pendente ? "Limpando…" : "Limpar dados de teste (WhatsApp)"}
    </Button>
  );
}
