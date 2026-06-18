"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, UserX } from "lucide-react";
import { exportarDadosTitular, anonimizarTitular } from "@/lib/actions/lgpd";

const TIPOS_EXPORT = new Set(["acesso", "portabilidade"]);
const TIPOS_ANONIMIZAR = new Set(["eliminacao", "anonimizacao"]);

/** Ações executáveis de um DSAR: exportar dados (acesso/portabilidade) ou anonimizar (eliminação). */
export function DsarAcoes({ id, tipo, nome }: { id: string; tipo: string; nome: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function exportar() {
    iniciar(async () => {
      const r = await exportarDadosTitular(id);
      if (r.erro || !r.conteudo) {
        toast.error(r.erro ?? "Falha ao exportar.");
        return;
      }
      // Baixa o JSON no navegador do operador para entrega ao titular.
      const blob = new Blob([r.conteudo], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.arquivo ?? "dsar.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados.");
      router.refresh();
    });
  }

  function anonimizar() {
    if (
      !window.confirm(
        `Anonimizar definitivamente os dados de "${nome}"? Os identificadores serão removidos e não há como desfazer. Reservas e pagamentos são mantidos por obrigação legal.`
      )
    )
      return;
    iniciar(async () => {
      const r = await anonimizarTitular(id);
      if (r.erro) toast.error(r.erro);
      else {
        toast.success("Titular anonimizado.");
        router.refresh();
      }
    });
  }

  if (TIPOS_EXPORT.has(tipo)) {
    return (
      <button
        type="button"
        disabled={pendente}
        onClick={exportar}
        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" /> Exportar
      </button>
    );
  }

  if (TIPOS_ANONIMIZAR.has(tipo)) {
    return (
      <button
        type="button"
        disabled={pendente}
        onClick={anonimizar}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <UserX className="h-3.5 w-3.5" /> Anonimizar
      </button>
    );
  }

  return <span className="text-xs text-muted-foreground">manual</span>;
}
