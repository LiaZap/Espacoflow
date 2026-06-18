"use client";

import { useState, useTransition } from "react";
import { ScanLine } from "lucide-react";
import { lerComprovantePagamento } from "@/lib/actions/pagamentos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatarBRL } from "@/lib/utils";

export function LeituraComprovante({
  id,
  temComprovante,
  valorLido,
  pagador,
  dataLida,
  obs,
  confere,
  jaLido,
}: {
  id: string;
  temComprovante: boolean;
  valorLido: number | null;
  pagador: string | null;
  dataLida: string | null;
  obs: string | null;
  confere: boolean | null;
  jaLido: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function ler() {
    setErro(null);
    startTransition(async () => {
      const r = await lerComprovantePagamento(id);
      if (r.erro) setErro(r.erro);
    });
  }

  if (!temComprovante) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="space-y-1">
      {jaLido ? (
        <div className="space-y-0.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">
              {valorLido != null ? formatarBRL(Math.round(valorLido * 100)) : "valor não lido"}
            </span>
            {confere === true ? (
              <Badge variant="success">confere</Badge>
            ) : confere === false ? (
              <Badge variant="destructive">diverge</Badge>
            ) : null}
          </div>
          {pagador ? <p className="text-muted-foreground">{pagador}</p> : null}
          {dataLida ? <p className="text-muted-foreground">{dataLida}</p> : null}
          {obs ? <p className="text-muted-foreground">{obs}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Não lido ainda.</p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pendente}
        onClick={ler}
        className="h-7 px-2 text-xs"
      >
        <ScanLine className="h-3.5 w-3.5" /> {pendente ? "Lendo…" : jaLido ? "Reler" : "Ler comprovante"}
      </Button>
      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
    </div>
  );
}
