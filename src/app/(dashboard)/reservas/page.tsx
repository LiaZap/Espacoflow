import Link from "next/link";
import { Plus, CalendarRange, UserCheck } from "lucide-react";
import { listarReservas } from "@/lib/actions/reservas";
import { exigirSessao } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CancelarReservaBotao } from "./_components/cancelar-reserva-botao";
import { CheckinBotoes } from "./_components/checkin-botoes";
import { formatarDataHora } from "@/lib/utils";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  rascunho: "secondary",
  pendente: "warning",
  confirmada: "success",
  concluida: "default",
  cancelada: "destructive",
  no_show: "destructive",
};

export default async function ReservasPage() {
  const [reservas, sessao] = await Promise.all([listarReservas(), exigirSessao()]);
  const podeCheckin = temPermissao(sessao.role, "reservas", "checkin");

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Reservas"
        descricao="Agenda de uso das salas. O sistema bloqueia sobreposição de horários."
        acao={
          <div className="flex gap-2">
            {podeCheckin ? (
              <Button asChild variant="outline">
                <Link href="/reservas/presenca">
                  <UserCheck className="h-4 w-4" /> Presença do dia
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/reservas/ocupacao">
                <CalendarRange className="h-4 w-4" /> Ocupação do dia
              </Link>
            </Button>
            <Button asChild>
              <Link href="/reservas/nova">
                <Plus className="h-4 w-4" /> Nova reserva
              </Link>
            </Button>
          </div>
        }
      />

      {reservas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nenhuma reserva registrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Sala</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Duração</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {r.inicio_em ? formatarDataHora(r.inicio_em) : `${r.data} ${r.hora}`}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.sala_nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.cliente_nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.duracao_min} min</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTE[r.status_reserva] ?? "secondary"}>
                      {r.status_reserva}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.status_pagamento}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.status_reserva === "cancelada" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <>
                          {podeCheckin ? <CheckinBotoes id={r.id} status={r.status_reserva} /> : null}
                          {r.status_reserva !== "concluida" ? (
                            <CancelarReservaBotao
                              id={r.id}
                              resumo={`${r.sala_nome} • ${r.cliente_nome} • ${
                                r.inicio_em ? formatarDataHora(r.inicio_em) : `${r.data} ${r.hora}`
                              }`}
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
