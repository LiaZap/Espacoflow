"use server";

import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { removerEventoReserva } from "@/lib/google/calendar";
import { lgpdConfig, lgpdSolicitacoes, type LgpdSolicitacao } from "@/lib/db/schema/lgpd";
import {
  clientes,
  clientesAnotacoes,
  clientesConsentimentos,
  type Cliente,
} from "@/lib/db/schema/clientes";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { whatsappConversas, whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { solicitacaoSchema } from "@/lib/validators/lgpd";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, primeiroErro } from "./_helpers";

export async function obterConfigLgpd() {
  await exigirPermissao("configuracoes", "ler");
  const [c] = await db.select().from(lgpdConfig).where(eq(lgpdConfig.is_deleted, false)).limit(1);
  return c ?? null;
}

export async function listarSolicitacoes() {
  await exigirPermissao("configuracoes", "ler");
  return db
    .select()
    .from(lgpdSolicitacoes)
    .where(eq(lgpdSolicitacoes.is_deleted, false))
    .orderBy(desc(lgpdSolicitacoes.created_at));
}

export type FormState = { erro?: string; ok?: boolean };

export async function criarSolicitacao(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  const parsed = solicitacaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  const prazo = new Date(Date.now() + 15 * 86_400_000); // prazo legal de 15 dias
  const [nova] = await db
    .insert(lgpdSolicitacoes)
    .values({
      nome_solicitante: d.nome_solicitante,
      email_solicitante: d.email_solicitante || null,
      telefone_solicitante: d.telefone_solicitante || null,
      tipo: d.tipo,
      prioridade: d.prioridade,
      descricao: d.descricao || null,
      status: "aberto",
      prazo_em: prazo,
      modified_by: sessao.userId,
    })
    .returning();

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "criar",
    entidade: "lgpd_solicitacoes",
    registroId: nova.id,
    detalhes: `DSAR (${d.tipo}) de ${d.nome_solicitante}`,
  });
  revalidatePath("/configuracoes/lgpd");
  return { ok: true };
}

/**
 * Localiza o titular (cliente) de uma solicitação: por cliente_id se houver,
 * senão por e-mail ou telefone informados no pedido.
 */
async function localizarTitular(sol: LgpdSolicitacao): Promise<Cliente | null> {
  if (sol.cliente_id) {
    const [c] = await db.select().from(clientes).where(eq(clientes.id, sol.cliente_id));
    if (c) return c;
  }
  const tel = (sol.telefone_solicitante ?? "").replace(/\D/g, "");
  const email = (sol.email_solicitante ?? "").toLowerCase().trim();
  const conds = [];
  // Comparação case-insensitive: e-mails antigos podem ter sido gravados com maiúsculas.
  if (email) conds.push(sql`lower(${clientes.email}) = ${email}`);
  if (tel) conds.push(eq(clientes.telefone, tel));
  if (conds.length === 0) return null;
  const [c] = await db
    .select()
    .from(clientes)
    .where(and(or(...conds), eq(clientes.is_deleted, false)));
  return c ?? null;
}

/**
 * EXECUTA acesso/portabilidade: reúne todos os dados pessoais do titular num
 * JSON estruturado (cliente, anotações, consentimentos, reservas, pagamentos e
 * conversas/mensagens) para entrega ao titular. Marca a solicitação como resolvida.
 */
export async function exportarDadosTitular(
  id: string
): Promise<{ erro?: string; conteudo?: string; arquivo?: string }> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  const [sol] = await db
    .select()
    .from(lgpdSolicitacoes)
    .where(and(eq(lgpdSolicitacoes.id, id), eq(lgpdSolicitacoes.is_deleted, false)));
  if (!sol) return { erro: "Solicitação não encontrada." };

  const titular = await localizarTitular(sol);
  if (!titular) return { erro: "Não localizei um cliente com esse e-mail/telefone na base." };

  const [anotacoes, consentimentos, convs] = await Promise.all([
    db.select().from(clientesAnotacoes).where(eq(clientesAnotacoes.cliente_id, titular.id)),
    db.select().from(clientesConsentimentos).where(eq(clientesConsentimentos.cliente_id, titular.id)),
    db.select().from(whatsappConversas).where(eq(whatsappConversas.cliente_id, titular.id)),
  ]);
  const convIds = convs.map((c) => c.id);
  const [resv, pgs, msgs] = await Promise.all([
    db.select().from(reservas).where(eq(reservas.cliente_id, titular.id)),
    db.select().from(pagamentos).where(eq(pagamentos.cliente_id, titular.id)),
    convIds.length
      ? db.select().from(whatsappMensagens).where(inArray(whatsappMensagens.conversa_id, convIds))
      : Promise.resolve([]),
  ]);

  const dump = {
    gerado_em: new Date().toISOString(),
    solicitacao: { id: sol.id, tipo: sol.tipo },
    titular,
    anotacoes,
    consentimentos,
    reservas: resv,
    pagamentos: pgs,
    conversas: convs,
    mensagens: msgs,
  };

  await db
    .update(lgpdSolicitacoes)
    .set({
      status: "resolvido",
      resolvido_em: new Date(),
      cliente_id: titular.id,
      notas_resolucao: `Export de dados gerado (${resv.length} reservas, ${pgs.length} pagamentos, ${msgs.length} mensagens).`,
      updated_at: new Date(),
      modified_by: sessao.userId,
    })
    .where(eq(lgpdSolicitacoes.id, id));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "lgpd_solicitacoes",
    registroId: id,
    detalhes: `Export DSAR do titular ${titular.id}`,
  });
  revalidatePath("/configuracoes/lgpd");

  return {
    conteudo: JSON.stringify(dump, null, 2),
    arquivo: `dsar_${titular.id}.json`,
  };
}

/**
 * EXECUTA eliminação/anonimização: remove os identificadores diretos do titular
 * e limpa anotações e conteúdo de mensagens (que podem conter PII). Reservas e
 * pagamentos são RETIDOS por obrigação legal/fiscal, apenas desvinculados de PII.
 */
export async function anonimizarTitular(id: string): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  const [sol] = await db
    .select()
    .from(lgpdSolicitacoes)
    .where(and(eq(lgpdSolicitacoes.id, id), eq(lgpdSolicitacoes.is_deleted, false)));
  if (!sol) return { erro: "Solicitação não encontrada." };

  const titular = await localizarTitular(sol);
  if (!titular) return { erro: "Não localizei um cliente com esse e-mail/telefone na base." };

  await db.transaction(async (tx) => {
    // Identificadores diretos do cliente (telefone é UNIQUE/NOT NULL → placeholder único).
    await tx
      .update(clientes)
      .set({
        nome: "Titular anonimizado",
        nome_chamada: null,
        telefone: `anon:${titular.id}`,
        email: null,
        documento: null,
        interesses: null,
        dores: null,
        bloqueado: true,
        status_lead: "inativo",
        is_deleted: true,
        deleted_at: new Date(),
        updated_at: new Date(),
        modified_by: sessao.userId,
      })
      .where(eq(clientes.id, titular.id));

    // Anotações podem conter PII livre → limpa e arquiva.
    await tx
      .update(clientesAnotacoes)
      .set({
        titulo: null,
        descricao: null,
        is_deleted: true,
        deleted_at: new Date(),
        updated_at: new Date(),
        modified_by: sessao.userId,
      })
      .where(eq(clientesAnotacoes.cliente_id, titular.id));

    // Conteúdo das mensagens / payload bruto podem conter PII → limpa.
    const convs = await tx
      .select({ id: whatsappConversas.id })
      .from(whatsappConversas)
      .where(eq(whatsappConversas.cliente_id, titular.id));
    const convIds = convs.map((c) => c.id);
    if (convIds.length) {
      await tx
        .update(whatsappMensagens)
        .set({ conteudo: null, midia_url: null, payload_bruto: null, updated_at: new Date() })
        .where(inArray(whatsappMensagens.conversa_id, convIds));
    }

    // Pagamentos são RETIDOS (valor/status) por obrigação fiscal, mas os
    // identificadores diretos do pagador (nome lido + imagem do comprovante) saem.
    await tx
      .update(pagamentos)
      .set({
        pagador_lido: null,
        comprovante_url: null,
        leitura_obs: null,
        updated_at: new Date(),
        modified_by: sessao.userId,
      })
      .where(eq(pagamentos.cliente_id, titular.id));

    await tx
      .update(lgpdSolicitacoes)
      .set({
        status: "resolvido",
        resolvido_em: new Date(),
        cliente_id: titular.id,
        notas_resolucao:
          "Titular anonimizado. Reservas e pagamentos retidos por obrigação legal/fiscal, sem identificadores diretos.",
        updated_at: new Date(),
        modified_by: sessao.userId,
      })
      .where(eq(lgpdSolicitacoes.id, id));
  });

  // Remove do Google Calendar os eventos que carregam nome/telefone do titular
  // (description "Cliente: ... / Telefone: ..."). Best-effort — fora da transação.
  const eventos = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(and(eq(reservas.cliente_id, titular.id), isNotNull(reservas.google_event_id)));
  for (const ev of eventos) {
    await removerEventoReserva(ev.id).catch(() => undefined);
  }

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "clientes",
    registroId: titular.id,
    severidade: "warn",
    detalhes: `Anonimização LGPD do titular (DSAR ${id})`,
  });
  revalidatePath("/configuracoes/lgpd");
  revalidatePath("/clientes");
  return { ok: true };
}

export async function atualizarStatusSolicitacao(
  id: string,
  status: "aberto" | "em_andamento" | "resolvido" | "rejeitado"
): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  await db
    .update(lgpdSolicitacoes)
    .set({
      status,
      resolvido_em: status === "resolvido" || status === "rejeitado" ? new Date() : null,
      updated_at: new Date(),
      modified_by: sessao.userId,
    })
    .where(and(eq(lgpdSolicitacoes.id, id), eq(lgpdSolicitacoes.is_deleted, false)));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "lgpd_solicitacoes",
    registroId: id,
    detalhes: `DSAR → ${status}`,
  });
  revalidatePath("/configuracoes/lgpd");
  return {};
}
