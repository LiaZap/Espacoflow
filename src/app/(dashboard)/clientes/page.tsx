import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { listarClientes, excluirCliente } from "@/lib/actions/clientes";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExcluirBotao } from "@/components/excluir-botao";
import { formatarDataHora } from "@/lib/utils";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  novo: "secondary",
  qualificando: "warning",
  apto: "default",
  cliente: "success",
  fora_perfil: "destructive",
  inativo: "secondary",
};

export default async function ClientesPage() {
  const clientes = await listarClientes();

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Clientes"
        descricao="Leads e clientes captados pelo WhatsApp."
        acao={
          <Button asChild>
            <Link href="/clientes/novo">
              <Plus className="h-4 w-4" /> Novo cliente
            </Link>
          </Button>
        }
      />

      {clientes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nenhum cliente cadastrado ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Última atividade</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.telefone}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTE[c.status_lead] ?? "secondary"}>{c.status_lead}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.ultima_atividade ? formatarDataHora(c.ultima_atividade) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label="Editar">
                        <Link href={`/clientes/${c.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <ExcluirBotao
                        acao={excluirCliente}
                        id={c.id}
                        titulo={`Excluir ${c.nome}?`}
                        resumo={`O cliente ${c.nome} (${c.telefone}) será marcado como excluído.`}
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
