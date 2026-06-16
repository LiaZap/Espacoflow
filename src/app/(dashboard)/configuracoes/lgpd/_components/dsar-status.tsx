"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { atualizarStatusSolicitacao } from "@/lib/actions/lgpd";

type Status = "aberto" | "em_andamento" | "resolvido" | "rejeitado";
const STATUS: Array<[Status, string]> = [
  ["aberto", "Aberto"],
  ["em_andamento", "Em andamento"],
  ["resolvido", "Resolvido"],
  ["rejeitado", "Rejeitado"],
];

export function DsarStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <select
      disabled={pendente}
      defaultValue={status}
      onChange={(e) =>
        iniciar(async () => {
          const r = await atualizarStatusSolicitacao(id, e.target.value as Status);
          if (r?.erro) toast.error(r.erro);
          else {
            toast.success("Status atualizado.");
            router.refresh();
          }
        })
      }
      className="rounded-md border border-input bg-card px-2 py-1 text-xs"
    >
      {STATUS.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
