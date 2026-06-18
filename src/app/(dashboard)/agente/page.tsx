import { obterConfig, previewPrompt, listarPrecos, listarBaseConhecimento } from "@/lib/actions/agente";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatarBRL } from "@/lib/utils";
import { AgenteConfigForm } from "./_components/agente-config-form";
import { ChatTeste } from "./_components/chat-teste";

export default async function AgentePage() {
  const config = await obterConfig();
  if (!config) {
    return (
      <div className="p-8">
        <PageHeader titulo="Agente Hígia" />
        <p className="mt-6 text-muted-foreground">
          Configuração não encontrada. Rode <code>npm run db:seed</code>.
        </p>
      </div>
    );
  }

  const [prompt, precos, base] = await Promise.all([
    previewPrompt(),
    listarPrecos(),
    listarBaseConhecimento(),
  ]);

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Agente Hígia"
        descricao="Persona, base de conhecimento e preços. O prompt é montado em runtime a partir das tabelas."
      />

      <Tabs defaultValue="testar">
        <TabsList>
          <TabsTrigger value="testar">Testar</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="prompt">Prompt (preview)</TabsTrigger>
          <TabsTrigger value="conhecimento">Base & Preços</TabsTrigger>
        </TabsList>

        <TabsContent value="testar">
          <Card>
            <CardHeader>
              <CardTitle>Testar a Hígia</CardTitle>
              <CardDescription>
                Converse com a Hígia aqui, sem precisar de WhatsApp nem do número do cliente. Usa o prompt,
                o modelo e a base de conhecimento reais — não grava no banco nem envia mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChatTeste nomeAgente={config.nome_agente} modelo={config.modelo_ia} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Hígia</CardTitle>
              <CardDescription>Identidade, horário e comportamento do atendimento.</CardDescription>
            </CardHeader>
            <CardContent>
              <AgenteConfigForm config={config} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle>Prompt montado em runtime</CardTitle>
              <CardDescription>
                Gerado a partir da persona + preços + base de conhecimento (fonte única auditável).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-xs leading-relaxed">
                {prompt}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conhecimento" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tabela de preços</CardTitle>
              <CardDescription>A Hígia só informa valores após qualificar a necessidade.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {precos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span>{p.descricao}</span>
                    <span className="font-medium">
                      {formatarBRL(Math.round(Number(p.valor) * 100))} / {p.unidade}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Base de conhecimento</CardTitle>
              <CardDescription>Injetada no prompt da Hígia em runtime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {base.map((b) => (
                <div key={b.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary">{b.categoria}</Badge>
                    <span className="text-sm font-medium">{b.titulo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{b.conteudo}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
