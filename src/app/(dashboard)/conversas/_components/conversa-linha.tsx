"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatarDataHora } from "@/lib/utils";
import { BotaoDevolverHigia } from "./botao-devolver-higia";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "success" | "warning"> = {
  higia: "default",
  humano: "warning",
  pausado: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  higia: "Hígia",
  humano: "Humano",
  pausado: "Pausado",
};

export interface ConversaResumo {
  id: string;
  cliente_nome: string;
  telefone: string;
  status: string;
  nao_lidas: number;
  ultima_mensagem_em: Date | null;
}

/** Linha clicável da inbox — abre o thread em qualquer célula e mostra o atalho "Devolver à Hígia". */
export function ConversaLinha({ c }: { c: ConversaResumo }) {
  const router = useRouter();
  const podeDevolver = c.status === "humano" || c.status === "pausado";

  return (
    <tr
      onClick={() => router.push(`/conversas/${c.id}`)}
      className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/40"
    >
      <td className="px-4 py-3 font-medium text-primary">{c.cliente_nome}</td>
      <td className="px-4 py-3 text-muted-foreground">{c.telefone}</td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANTE[c.status] ?? "secondary"}>
          {STATUS_LABEL[c.status] ?? c.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {c.nao_lidas > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {c.nao_lidas}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {c.ultima_mensagem_em ? formatarDataHora(c.ultima_mensagem_em) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        {podeDevolver ? <BotaoDevolverHigia id={c.id} /> : null}
      </td>
    </tr>
  );
}
