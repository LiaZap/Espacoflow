import { provedorConfigurado } from "@/lib/whatsapp/provider";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimularMensagemForm } from "./_components/simular-mensagem-form";
import { TestarEnvioForm } from "./_components/testar-envio-form";

export default function WhatsappConfigPage() {
  const conectado = provedorConfigurado();
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const webhookUrl = `${base}/api/whatsapp/webhook`;

  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="WhatsApp" descricao="Conexão de mensageria e testes do fluxo da Hígia." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Status do provedor
            <Badge variant={conectado ? "success" : "warning"}>
              {conectado ? "Evolution conectado" : "Sandbox (sem credenciais)"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Sem credenciais, os envios são apenas registrados (modo sandbox) — ideal para testar o
            fluxo. Configure as variáveis no <code>.env</code> para conectar de verdade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">URL do webhook (aponte o provedor para cá): </span>
            <code className="rounded bg-muted px-1.5 py-0.5">{webhookUrl}</code>
          </p>
          <ul className="list-inside list-disc text-muted-foreground">
            <li><code>WHATSAPP_PROVIDER=evolution</code></li>
            <li><code>WHATSAPP_API_URL</code>, <code>WHATSAPP_API_TOKEN</code>, <code>WHATSAPP_INSTANCIA</code></li>
            <li><code>WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> (valide com header <code>x-webhook-token</code>)</li>
            <li><code>ANTHROPIC_API_KEY</code> para a Hígia responder automaticamente</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simular mensagem recebida</CardTitle>
          <CardDescription>Testa ingestão + resposta da Hígia sem um número real.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimularMensagemForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar envio</CardTitle>
          <CardDescription>Dispara uma mensagem pelo provedor configurado.</CardDescription>
        </CardHeader>
        <CardContent>
          <TestarEnvioForm />
        </CardContent>
      </Card>
    </div>
  );
}
