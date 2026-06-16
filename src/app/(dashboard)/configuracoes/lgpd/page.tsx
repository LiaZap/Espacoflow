import { obterConfigLgpd, listarSolicitacoes } from "@/lib/actions/lgpd";
import { TIPOS_DSAR } from "@/lib/validators/lgpd";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DsarNovaForm } from "./_components/dsar-nova-form";
import { DsarStatus } from "./_components/dsar-status";
import { formatarDataHora } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS_DSAR);

export default async function LgpdPage() {
  const [cfg, sols] = await Promise.all([obterConfigLgpd(), listarSolicitacoes()]);

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="LGPD & Privacidade"
        descricao="Governança de dados e solicitações de titulares (DSAR)."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Política de governança</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info t="Retenção pós-cancelamento" v={cfg ? `${cfg.retencao_dias_apos_cancelamento} dias` : "—"} />
          <Info t="Retenção de auditoria" v={cfg ? `${cfg.retencao_auditoria_dias} dias` : "—"} />
          <Info t="DPO" v={cfg?.email_dpo ?? "—"} />
          <Info t="Aprovação p/ DSAR" v={cfg ? (cfg.exige_aprovacao_dsar ? "Sim" : "Não") : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova solicitação (DSAR)</CardTitle>
          <CardDescription>O prazo legal de 15 dias é calculado automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <DsarNovaForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          {sols.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Solicitante</th>
                    <th className="py-2 font-medium">Tipo</th>
                    <th className="py-2 font-medium">Prazo</th>
                    <th className="py-2 font-medium">Criado</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sols.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{s.nome_solicitante}</td>
                      <td className="py-2 text-muted-foreground">{TIPO_LABEL[s.tipo] ?? s.tipo}</td>
                      <td className="py-2 text-muted-foreground">
                        {s.prazo_em ? formatarDataHora(s.prazo_em) : "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">{formatarDataHora(s.created_at)}</td>
                      <td className="py-2">
                        <DsarStatus id={s.id} status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ t, v }: { t: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{t}</p>
      <p className="mt-0.5 font-medium">{v}</p>
    </div>
  );
}
