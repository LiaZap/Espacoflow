import { listarPacotes, listarSaldosAtivos } from "@/lib/actions/pacotes";
import { listarClientes } from "@/lib/actions/clientes";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarBRL } from "@/lib/utils";
import { VenderPacoteForm } from "./_components/vender-pacote-form";

export default async function PacotesPage() {
  const [pacotes, clientes, saldos] = await Promise.all([
    listarPacotes(),
    listarClientes(),
    listarSaldosAtivos(),
  ]);

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
          <CardDescription>Pacotes de clientes com horas disponíveis.</CardDescription>
        </CardHeader>
        <CardContent>
          {saldos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum saldo ativo.</p>
          ) : (
            <ul className="divide-y text-sm">
              {saldos.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>
                    {s.cliente_nome} — <span className="text-muted-foreground">{s.pacote_nome}</span>
                  </span>
                  <span className="font-medium">{s.horas_saldo}h até {s.valido_ate}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
