import { listarPagamentos } from "@/lib/actions/pagamentos";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ValidarPixBotoes } from "./_components/validar-pix-botoes";
import { ComprovanteUpload } from "./_components/comprovante-upload";
import { LeituraComprovante } from "./_components/leitura-comprovante";
import { ReciboBotao } from "./_components/recibo-botao";
import { formatarBRL, formatarDataHora } from "@/lib/utils";

const STATUS_VARIANTE: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pendente: "warning",
  em_analise: "warning",
  confirmado: "success",
  recusado: "destructive",
  reembolsado: "secondary",
};

export default async function PagamentosPage() {
  const pagamentos = await listarPagamentos();

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Pagamentos PIX"
        descricao="Validação manual de comprovantes (apenas a equipe — nunca a Hígia)."
      />

      {pagamentos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nenhum pagamento registrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Referente a</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Comprovante</th>
                <th className="px-4 py-3 font-medium">Leitura (IA)</th>
                <th className="px-4 py-3 font-medium">Recebido</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.cliente_nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.reserva_id ? "Reserva" : p.cliente_pacote_id ? "Pacote de horas" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.valor ? formatarBRL(Math.round(Number(p.valor) * 100)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ComprovanteUpload id={p.id} atual={p.comprovante_url} />
                  </td>
                  <td className="px-4 py-3">
                    <LeituraComprovante
                      id={p.id}
                      temComprovante={Boolean(p.comprovante_url)}
                      valorLido={p.valor_lido != null ? Number(p.valor_lido) : null}
                      pagador={p.pagador_lido}
                      dataLida={p.data_lida}
                      obs={p.leitura_obs}
                      confere={p.leitura_confere}
                      jaLido={Boolean(p.leitura_em)}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatarDataHora(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTE[p.status] ?? "secondary"}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "pendente" || p.status === "em_analise" ? (
                      <ValidarPixBotoes
                        id={p.id}
                        resumo={`${p.cliente_nome} • ${
                          p.valor ? formatarBRL(Math.round(Number(p.valor) * 100)) : "—"
                        } • ${p.reserva_id ? "Reserva" : "Pacote"}`}
                      />
                    ) : p.status === "confirmado" ? (
                      <ReciboBotao id={p.id} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{p.status}</span>
                    )}
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
