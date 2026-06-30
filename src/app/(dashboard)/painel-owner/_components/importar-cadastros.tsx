"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { importarCadastrosFormulario } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

/** Importa os clientes da planilha do formulário como recorrentes. Só owner. */
export function ImportarCadastros() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function importar() {
    if (!window.confirm("Importar os cadastros da planilha do formulário como clientes recorrentes? (atualiza os já existentes pelo telefone)")) {
      return;
    }
    iniciar(async () => {
      const r = await importarCadastrosFormulario();
      if (r.erro) toast.error(r.erro);
      else {
        toast.success(`Importação concluída: ${r.criados ?? 0} novo(s), ${r.atualizados ?? 0} atualizado(s).`);
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pendente} onClick={importar}>
      <Download className="h-4 w-4" /> {pendente ? "Importando…" : "Importar cadastros (planilha)"}
    </Button>
  );
}
