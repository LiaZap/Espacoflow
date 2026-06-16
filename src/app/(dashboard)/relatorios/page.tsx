import { dadosRelatorios } from "@/lib/actions/relatorios";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart, RankBars } from "@/components/relatorios/charts";
import { formatarBRL } from "@/lib/utils";

export default async function RelatoriosPage() {
  const d = await dadosRelatorios();

  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="Relatórios" descricao="Indicadores do coworking — últimos 14 dias e geral." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Reservas (14d)" valor={d.kpis.reservas14d} />
        <Kpi titulo="Receita Pix confirmada" valor={formatarBRL(d.kpis.receitaTotalCentavos)} />
        <Kpi
          titulo="Comparecimento"
          valor={d.kpis.comparecimento != null ? `${d.kpis.comparecimento}%` : "—"}
        />
        <Kpi titulo="Reservas (total)" valor={d.kpis.reservasTotal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reservas por dia</CardTitle>
            <CardDescription>Últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart dados={d.reservasPorDia} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita Pix por dia</CardTitle>
            <CardDescription>Pagamentos confirmados (R$)</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart dados={d.receitaPorDia} formato={(v) => `R$${v}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das reservas</CardTitle>
            <CardDescription>Distribuição geral</CardDescription>
          </CardHeader>
          <CardContent>
            <RankBars dados={d.porStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ocupação por sala</CardTitle>
            <CardDescription>Total de reservas por sala</CardDescription>
          </CardHeader>
          <CardContent>
            <RankBars dados={d.porSala} cor="bg-primary" />
          </CardContent>
        </Card>
      </div>
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
