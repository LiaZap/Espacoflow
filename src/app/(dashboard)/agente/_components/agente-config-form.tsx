"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarConfig, type FormState } from "@/lib/actions/agente";
import type { AgenteConfig } from "@/lib/db/schema/agente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_BOAS_VINDAS_NOVO, DEFAULT_FORA_PERFIL } from "@/lib/agente/mensagens-padrao";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar configuração"}
    </Button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function AgenteConfigForm({ config }: { config: AgenteConfig }) {
  const [state, action] = useActionState<FormState, FormData>(salvarConfig, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={config.id} />
      <input type="hidden" name="updated_at" value={new Date(config.updated_at).toISOString()} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome do espaço">
          <Input name="nome_espaco" defaultValue={config.nome_espaco} />
        </Campo>
        <Campo label="Nome do agente">
          <Input name="nome_agente" defaultValue={config.nome_agente} />
        </Campo>
        <Campo label="Modelo de IA">
          <Input name="modelo_ia" defaultValue={config.modelo_ia} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Abre às">
            <Input name="hora_inicio" type="time" defaultValue={config.hora_inicio?.slice(0, 5) ?? ""} />
          </Campo>
          <Campo label="Fecha às">
            <Input name="hora_fim" type="time" defaultValue={config.hora_fim?.slice(0, 5) ?? ""} />
          </Campo>
        </div>
        <Campo label="Resposta automática">
          <select name="resposta_automatica" defaultValue={String(config.resposta_automatica)} className={selectClasses}>
            <option value="true">Ativada</option>
            <option value="false">Desativada</option>
          </select>
        </Campo>
        <Campo label="Permitir reserva via IA">
          <select name="reserva_via_ia" defaultValue={String(config.reserva_via_ia)} className={selectClasses}>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </Campo>
      </div>

      <Campo label="Prompt-base / persona (deixe vazio para usar o padrão da Hígia)">
        <Textarea name="prompt_sistema" rows={6} defaultValue={config.prompt_sistema ?? ""} />
      </Campo>

      <div className="space-y-4 rounded-md border p-4">
        <div>
          <p className="text-sm font-medium">Mensagens da Hígia</p>
          <p className="text-xs text-muted-foreground">
            Edite os textos que a Hígia usa. Vale na hora ao salvar, sem precisar de deploy. As regras e
            ferramentas não mudam — só o texto. Deixe um campo vazio para voltar ao padrão.
          </p>
        </div>
        <Campo label="Boas-vindas (cliente novo) — saudação (bom dia/tarde/noite) é automática">
          <Textarea
            name="msg_boas_vindas_novo"
            rows={10}
            defaultValue={config.msg_boas_vindas_novo || DEFAULT_BOAS_VINDAS_NOVO}
          />
        </Campo>
        <Campo label="Fora do perfil (quando não atende o cliente)">
          <Textarea
            name="msg_fora_perfil"
            rows={3}
            defaultValue={config.msg_fora_perfil || DEFAULT_FORA_PERFIL}
          />
        </Campo>
        <Campo label="Boas-vindas / acesso (após a reserva confirmada) — use {{SALA}} e {{ACESSO}}">
          <Textarea
            name="msg_boas_vindas"
            rows={8}
            defaultValue={config.msg_boas_vindas ?? ""}
            placeholder="Enviada quando o pagamento é confirmado. Use {{SALA}} e {{ACESSO}} para inserir a sala e o código de acesso automaticamente."
          />
        </Campo>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div>
          <p className="text-sm font-medium">Pix (a Hígia envia como texto)</p>
          <p className="text-xs text-muted-foreground">
            Quando o cliente vai pagar, a Hígia manda a chave exata aqui cadastrada. Deixe a chave vazia
            para desativar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Chave Pix">
            <Input name="pix_chave" defaultValue={config.pix_chave ?? ""} placeholder="CNPJ, e-mail, telefone ou aleatória" />
          </Campo>
          <Campo label="Favorecido (nome)">
            <Input name="pix_beneficiario" defaultValue={config.pix_beneficiario ?? ""} placeholder="Ex: Felipe Geraldo Torres LTDA" />
          </Campo>
        </div>
        <Campo label="Pix copia e cola (opcional)">
          <Textarea
            name="pix_copia_cola"
            rows={2}
            defaultValue={config.pix_copia_cola ?? ""}
            placeholder="Cole aqui o código copia e cola, se tiver. A Hígia envia numa mensagem separada para o cliente copiar."
          />
        </Campo>
        <Campo label="Instrução após o Pix (opcional)">
          <Input
            name="pix_instrucoes"
            defaultValue={config.pix_instrucoes ?? ""}
            placeholder="Padrão: peça o comprovante e avise que a equipe confirma."
          />
        </Campo>
      </div>

      {state?.erro ? (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success">Configuração salva.</p> : null}

      <Salvar />
    </form>
  );
}
