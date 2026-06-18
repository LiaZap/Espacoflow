import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { reservasDoDia } from "@/lib/actions/reservas";
import { exigirSessao } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckinBotoes } from "../_components/checkin-botoes";
import { PresencaData } from "../_components/presenca-data";

export const dynamic = "force-dynamic";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pendente: "warning",
  confirmada: "success",
  concluida: "default",
  no_show: "destructive",
};

const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default async function PresencaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const sessao = await exigirSessao();
  if (!temPermissao(sessao.role, "reservas", "checkin")) redirect("/reservas");

  const sp = await searchParams;
  const { dia, reservas, resumo } = await reservasDoDia(sp.data);

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Presença do dia"
        descricao={`Marque quem compareceu — alimenta a métrica de comparecimento. Dia ${fmtDia(dia)}.`}
        acao={
          <Button asChild variant="outline">
            <Link href="/reservas">
              <ArrowLeft className="h-4 w-4" /> Reservas
            </Link>
          </Button>
        }
      />

      <PresencaData dia={dia} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi titulo="Reservas no dia" valor={resumo.total} />
        <Kpi titulo="Compareceram" valor={resumo.compareceram} />
        <Kpi titulo="Faltaram" valor={resumo.faltaram} />
        <Kpi titulo="A marcar" valor={resumo.pendentes} />
      </div>

      {reservas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nenhuma reserva para este dia.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Sala</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Compareceu?</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.hora?.slice(0, 5)}</td>
                  <td className="px-4 py-3">{r.sala}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.cliente}</p>
                    <p className="text-xs text-muted-foreground">{r.telefone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTE[r.status] ?? "secondary"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <CheckinBotoes id={r.id} status={r.status} />
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

function Kpi({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold">{valor}</p>
    </div>
  );
}
