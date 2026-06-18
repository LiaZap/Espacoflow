import { dadosRelatorios, clientesParaSelect, relatorioCliente } from "@/lib/actions/relatorios";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart, RankBars } from "@/components/relatorios/charts";
import { formatarBRL } from "@/lib/utils";
import { RelatoriosControles } from "./_components/relatorios-controles";

export const dynamic = "force-dynamic";

const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; cliente?: string }>;
}) {
  const sp = await searchParams;

  const [d, listaClientes, doCliente] = await Promise.all([
    dadosRelatorios({ de: sp.de, ate: sp.ate }),
    clientesParaSelect(),
    sp.cliente ? relatorioCliente(sp.cliente, { de: sp.de, ate: sp.ate }) : Promise.resolve(null),
  ]);

  const { de, ate } = d.periodo;

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Relatórios"
        descricao={`Período: ${fmtDia(de)} a ${fmtDia(ate)}.`}
      />

      <RelatoriosControles de={de} ate={ate} cliente={sp.cliente ?? ""} clientes={listaClientes} />

      {/* Relatório por cliente */}
      {doCliente ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{doCliente.cliente.nome}</CardTitle>
            <CardDescription>
              {doCliente.cliente.telefone} · status: {doCliente.cliente.status_lead}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi titulo="Reservas" valor={doCliente.totais.reservas} />
              <Kpi titulo="Compareceu" valor={doCliente.totais.comparecimentos} />
              <Kpi titulo="Faltas" valor={doCliente.totais.faltas} />
              <Kpi titulo="Canceladas" valor={doCliente.totais.canceladas} />
              <Kpi titulo="Pago" valor={formatarBRL(doCliente.totais.valorPagoCentavos)} />
            </div>

            {doCliente.reservas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem reservas no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Hora</th>
                      <th className="px-3 py-2 font-medium">Sala</th>
                      <th className="px-3 py-2 font-medium">Finalidade</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doCliente.reservas.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">{fmtDia(r.data)}</td>
                        <td className="px-3 py-2">{r.hora?.slice(0, 5)}</td>
                        <td className="px-3 py-2">{r.sala}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.titulo}</td>
                        <td className="px-3 py-2">{r.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.status_pag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Visão geral do período */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Reservas no período" valor={d.kpis.reservasPeriodo} />
        <Kpi titulo="Receita Pix confirmada" valor={formatarBRL(d.kpis.receitaCentavos)} />
        <Kpi
          titulo="Comparecimento"
          valor={d.kpis.comparecimento != null ? `${d.kpis.comparecimento}%` : "—"}
        />
        <Kpi titulo="Concluídas" valor={d.kpis.concluidas} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reservas por dia</CardTitle>
            <CardDescription>Período selecionado</CardDescription>
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
            <CardDescription>Distribuição no período</CardDescription>
          </CardHeader>
          <CardContent>
            <RankBars dados={d.porStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ocupação por sala</CardTitle>
            <CardDescription>Reservas por sala no período</CardDescription>
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
