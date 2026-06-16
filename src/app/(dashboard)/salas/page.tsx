import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { listarSalas, excluirSala } from "@/lib/actions/salas";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExcluirBotao } from "@/components/excluir-botao";
import { formatarBRL } from "@/lib/utils";

export default async function SalasPage() {
  const salas = await listarSalas();

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Salas"
        descricao="Salas privativas reserváveis do Espaço Flow."
        acao={
          <Button asChild>
            <Link href="/salas/nova">
              <Plus className="h-4 w-4" /> Nova sala
            </Link>
          </Button>
        }
      />

      {salas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nenhuma sala cadastrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Sala</th>
                <th className="px-4 py-3 font-medium">Capacidade</th>
                <th className="px-4 py-3 font-medium">Preço/hora</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {salas.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.capacidade} pessoa(s)</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.preco_hora ? formatarBRL(Math.round(Number(s.preco_hora) * 100)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.ativa ? "success" : "secondary"}>{s.ativa ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label="Editar">
                        <Link href={`/salas/${s.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <ExcluirBotao
                        acao={excluirSala}
                        id={s.id}
                        titulo={`Excluir ${s.nome}?`}
                        resumo={`A sala ${s.nome} será marcada como excluída.`}
                      />
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
