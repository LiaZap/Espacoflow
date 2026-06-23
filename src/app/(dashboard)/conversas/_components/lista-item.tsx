"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BotaoDevolverHigia } from "./botao-devolver-higia";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "warning"> = {
  higia: "default",
  humano: "warning",
  pausado: "secondary",
};
const STATUS_LABEL: Record<string, string> = {
  higia: "Hígia",
  humano: "Humano",
  pausado: "Pausado",
};

export interface ItemConversa {
  id: string;
  cliente_nome: string;
  telefone: string;
  status: string;
  nao_lidas: number;
  quando: string;
}

/** Card de conversa na lista (esquerda). Clica → abre o chat à direita (?c=id). */
export function ListaItem({ c, ativo }: { c: ItemConversa; ativo: boolean }) {
  const podeDevolver = c.status === "humano" || c.status === "pausado";
  return (
    <Link
      href={`/conversas?c=${c.id}`}
      className={cn(
        "block border-b px-4 py-3 transition-colors hover:bg-muted/50",
        ativo && "bg-muted"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{c.cliente_nome}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{c.quando}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{c.telefone}</span>
        <div className="flex shrink-0 items-center gap-2">
          {c.nao_lidas > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
              {c.nao_lidas}
            </span>
          ) : null}
          <Badge variant={STATUS_VARIANTE[c.status] ?? "secondary"}>
            {STATUS_LABEL[c.status] ?? c.status}
          </Badge>
        </div>
      </div>
      {podeDevolver ? (
        <div className="mt-2">
          <BotaoDevolverHigia id={c.id} />
        </div>
      ) : null}
    </Link>
  );
}
