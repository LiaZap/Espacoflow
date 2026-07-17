import { listarPacotes, listarSaldosAtivos, listarMovimentos } from "@/lib/actions/pacotes";
import { listarClientes } from "@/lib/actions/clientes";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarBRL } from "@/lib/utils";
import { VenderPacoteForm } from "./_components/vender-pacote-form";
import { ConcederCreditoForm } from "./_components/conceder-credito-form";
import { AjustarSaldoForm } from "./_components/ajustar-saldo-form";
import { SaldosAtivos } from "./_components/saldos-ativos";

export default async function PacotesPage() {
  const [pacotes, clientes, saldos] = await Promise.all([
    listarPacotes(),
    listarClientes(),
    listarSaldosAtivos(),
  ]);

  // Extrato de cada saldo ativo (histórico expansível na seção "Saldos ativos").
  const movimentosPorSaldo = await Promise.all(saldos.map((s) => listarMovimentos(s.id)));
  const saldosComHistorico = saldos.map((s, i) => ({
    id: s.id,
    cliente_nome: s.cliente_nome,
    pacote_nome: s.pacote_nome,
    horas_saldo: String(s.horas_saldo),
    valido_ate: String(s.valido_ate),
    movimentos: movimentosPorSaldo[i].map((m) => ({
      id: m.id,
      tipo: m.tipo,
      horas: String(m.horas),
      saldo_apos: String(m.saldo_apos),
      motivo: m.motivo,
      created_at: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
    })),
  }));

  const pacotesAtivos = pacotes.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }));
  const clientesOpc = clientes.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone }));

  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="Pacotes & Saldo de horas" descricao="Catálogo, venda de pacotes e saldos ativos." />

      <Card>
        <CardHeader>
          <CardTitle>Vender pacote</CardTitle>
          <CardDescription>Gera o saldo de horas e um pagamento PIX pendente de validação.</CardDescription>
        </CardHeader>
        <CardContent>
          <VenderPacoteForm clientes={clientesOpc} pacotes={pacotesAtivos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conceder crédito (R$)</CardTitle>
          <CardDescription>
            Crédito de cortesia/ajuste em reais. A Hígia reconhece e aplica automaticamente na próxima reserva do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConcederCreditoForm clientes={clientesOpc} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajustar saldo (horas)</CardTitle>
          <CardDescription>
            Corrige o saldo de horas de um pacote (ex.: consumo feito no atendimento humano que não foi descontado).
            Lance +/- horas com o motivo — o histórico fica no extrato do saldo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AjustarSaldoForm saldos={saldosComHistorico} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Pacote</th>
                <th className="py-2 font-medium">Horas</th>
                <th className="py-2 font-medium">Validade</th>
                <th className="py-2 font-medium">Preço</th>
                <th className="py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pacotes.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{p.nome}</td>
                  <td className="py-2 text-muted-foreground">{p.horas_incluidas}h</td>
                  <td className="py-2 text-muted-foreground">{p.validade_dias} dias</td>
                  <td className="py-2">{formatarBRL(Math.round(Number(p.preco) * 100))}</td>
                  <td className="py-2">
                    <Badge variant={p.ativo ? "success" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldos ativos</CardTitle>
          <CardDescription>
            Pacotes de clientes com horas disponíveis. Clique na seta pra ver o histórico do saldo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaldosAtivos saldos={saldosComHistorico} />
        </CardContent>
      </Card>
    </div>
  );
}
