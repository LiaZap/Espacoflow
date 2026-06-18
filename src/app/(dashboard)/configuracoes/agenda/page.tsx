import { obterAgendaConfig } from "@/lib/actions/google-agenda";
import { googleConfigurado, redirectUri } from "@/lib/google/oauth";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgendaForm } from "./_components/agenda-form";

export const dynamic = "force-dynamic";

const MSG_ERRO: Record<string, string> = {
  sem_credenciais: "Faltam as credenciais do Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) no servidor.",
  sem_permissao: "Você não tem permissão para conectar.",
  oauth: "Autorização não concluída (o consentimento foi cancelado).",
  token: "Falha ao trocar o código por tokens. Verifique as credenciais e a redirect URI.",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const cfg = await obterAgendaConfig();
  const temCreds = googleConfigurado();

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Google Agenda"
        descricao="Conecte a agenda do Google para sincronizar as reservas do Espaço Flow."
      />

      {sp.ok === "conectado" ? (
        <p className="rounded-md bg-success/10 px-4 py-2 text-sm text-success">Google Agenda conectado com sucesso.</p>
      ) : null}
      {sp.erro ? (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {MSG_ERRO[sp.erro] ?? "Não foi possível conectar."}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Conexão</CardTitle>
          <CardDescription>Conta do Google vinculada à agenda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cfg.conectado ? (
            <p className="text-sm">
              Conectado{cfg.conta_email ? ` como ${cfg.conta_email}` : ""}. ✅
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não conectado.</p>
          )}

          {temCreds ? (
            <Button asChild variant={cfg.conectado ? "outline" : "default"}>
              <a href="/api/google/oauth/start">{cfg.conectado ? "Reconectar" : "Conectar Google Agenda"}</a>
            </Button>
          ) : (
            <p className="text-sm text-destructive">
              Defina <code className="font-mono">GOOGLE_CLIENT_ID</code> e{" "}
              <code className="font-mono">GOOGLE_CLIENT_SECRET</code> no ambiente do app para habilitar a conexão.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Qual agenda usar e se as reservas são sincronizadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgendaForm config={cfg} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como configurar no Google (uma vez)</CardTitle>
          <CardDescription>Necessário para o botão de conexão funcionar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. No Google Cloud Console: crie um OAuth Client (tipo Aplicativo Web) e habilite a Google Calendar API.</p>
          <p>
            2. Em &quot;URIs de redirecionamento autorizados&quot;, adicione:{" "}
            <code className="break-all font-mono">{redirectUri()}</code>
          </p>
          <p>
            3. No ambiente do app (EasyPanel → serviço web): defina{" "}
            <code className="font-mono">GOOGLE_CLIENT_ID</code>, <code className="font-mono">GOOGLE_CLIENT_SECRET</code>{" "}
            (e, se quiser fixar, <code className="font-mono">GOOGLE_REDIRECT_URI</code>).
          </p>
          <p>4. Volte aqui e clique em &quot;Conectar Google Agenda&quot; usando a conta nova do espaço.</p>
        </CardContent>
      </Card>
    </div>
  );
}
