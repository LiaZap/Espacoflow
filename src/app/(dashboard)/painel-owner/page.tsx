import { listarAuditoria } from "@/lib/actions/auditoria";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatarDataHora } from "@/lib/utils";

const SEV_VARIANTE: Record<string, "secondary" | "warning" | "destructive"> = {
  info: "secondary",
  warn: "warning",
  critical: "destructive",
};

export default async function PainelOwnerPage() {
  const eventos = await listarAuditoria();
  const exclusoes = eventos.filter((e) => e.acao === "excluir");
  const negados = eventos.filter((e) => e.acao === "acesso_negado");

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Painel Owner"
        descricao="Trilha de auditoria: quem fez o quê e quando. Inclui exclusões e acessos negados."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ResumoCard titulo="Eventos recentes" valor={eventos.length} />
        <ResumoCard titulo="Exclusões" valor={exclusoes.length} />
        <ResumoCard titulo="Acessos negados" valor={negados.length} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">Severidade</th>
              <th className="px-4 py-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  {formatarDataHora(e.created_at)}
                </td>
                <td className="px-4 py-2">{e.usuario ?? "sistema"}</td>
                <td className="px-4 py-2 font-medium">{e.acao}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.entidade}</td>
                <td className="px-4 py-2">
                  <Badge variant={SEV_VARIANTE[e.severidade] ?? "secondary"}>{e.severidade}</Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{e.detalhes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="text-3xl font-semibold">{valor}</p>
    </div>
  );
}
