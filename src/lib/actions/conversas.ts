"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { whatsappConversas, whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { clientes } from "@/lib/db/schema/clientes";
import { registrarAuditoria } from "@/lib/audit/logger";
import { getProvider } from "@/lib/whatsapp/provider";
import { ingerirMensagemRecebida } from "@/lib/whatsapp/ingestao";
import { despacharRespostaHigia } from "@/lib/fila/dispatch";
import { exigirPermissao } from "./_helpers";

export async function listarConversas() {
  await exigirPermissao("conversas", "ler");
  return db
    .select({
      id: whatsappConversas.id,
      cliente_nome: clientes.nome,
      telefone: clientes.telefone,
      status: whatsappConversas.status,
      nao_lidas: whatsappConversas.nao_lidas,
      ultima_mensagem_em: whatsappConversas.ultima_mensagem_em,
    })
    .from(whatsappConversas)
    .innerJoin(clientes, eq(whatsappConversas.cliente_id, clientes.id))
    .where(eq(whatsappConversas.is_deleted, false))
    .orderBy(desc(whatsappConversas.ultima_mensagem_em));
}

export async function obterConversa(id: string) {
  await exigirPermissao("conversas", "ler");
  const [conversa] = await db
    .select()
    .from(whatsappConversas)
    .where(and(eq(whatsappConversas.id, id), eq(whatsappConversas.is_deleted, false)));
  if (!conversa) return null;

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, conversa.cliente_id));
  const mensagens = await db
    .select()
    .from(whatsappMensagens)
    .where(and(eq(whatsappMensagens.conversa_id, id), eq(whatsappMensagens.is_deleted, false)))
    .orderBy(asc(whatsappMensagens.created_at));

  if (conversa.nao_lidas > 0) {
    await db.update(whatsappConversas).set({ nao_lidas: 0 }).where(eq(whatsappConversas.id, id));
  }

  return { conversa, cliente: cliente ?? null, mensagens };
}

/** Resposta manual: humano assume a conversa e envia pelo provedor. */
export async function enviarMensagemManual(conversaId: string, texto: string): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("conversas", "atualizar");
  const t = texto.trim();
  if (!t) return { erro: "Mensagem vazia." };

  const [conv] = await db
    .select()
    .from(whatsappConversas)
    .where(and(eq(whatsappConversas.id, conversaId), eq(whatsappConversas.is_deleted, false)));
  if (!conv) return { erro: "Conversa não encontrada." };

  const [cli] = await db.select().from(clientes).where(eq(clientes.id, conv.cliente_id));
  const envio = await getProvider().enviarTexto(cli?.telefone ?? "", t);

  await db.insert(whatsappMensagens).values({
    conversa_id: conversaId,
    origem: "humano",
    tipo: "text",
    conteudo: t,
    status: envio.ok ? "sent" : "failed",
    enviada_em: new Date(),
    id_externo: envio.idExterno ?? null,
    modified_by: sessao.userId,
  });
  await db
    .update(whatsappConversas)
    .set({
      status: "humano",
      atribuido_a: sessao.userId,
      ultima_mensagem_em: new Date(),
      updated_at: new Date(),
      modified_by: sessao.userId,
    })
    .where(eq(whatsappConversas.id, conversaId));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "whatsapp_conversas",
    registroId: conversaId,
    detalhes: "Resposta manual (humano assumiu)",
  });

  revalidatePath(`/conversas/${conversaId}`);
  revalidatePath("/conversas");
  return envio.ok ? {} : { erro: `Falha no envio: ${envio.erro ?? "desconhecida"}` };
}

export async function definirStatusConversa(
  id: string,
  status: "higia" | "humano" | "pausado"
): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("conversas", "atualizar");
  await db
    .update(whatsappConversas)
    .set({
      status,
      atribuido_a: status === "humano" ? sessao.userId : null,
      updated_at: new Date(),
      modified_by: sessao.userId,
    })
    .where(and(eq(whatsappConversas.id, id), eq(whatsappConversas.is_deleted, false)));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "whatsapp_conversas",
    registroId: id,
    detalhes: `Atendimento → ${status}`,
  });

  revalidatePath(`/conversas/${id}`);
  revalidatePath("/conversas");
  return {};
}

export type FormState = { erro?: string; ok?: boolean };

/** Simula uma mensagem recebida (teste do fluxo sem número real). */
export async function simularMensagemRecebida(_prev: FormState, formData: FormData): Promise<FormState> {
  await exigirPermissao("conversas", "atualizar");
  const telefone = String(formData.get("telefone") ?? "").replace(/\D/g, "");
  const nome = String(formData.get("nome") ?? "").trim() || undefined;
  const texto = String(formData.get("texto") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "text") || "text";
  const midiaUrl = String(formData.get("midia_url") ?? "").trim() || undefined;

  if (!/^\d{10,13}$/.test(telefone)) return { erro: "Telefone inválido (DDD + número)." };
  if (tipo === "text" && !texto) return { erro: "Escreva a mensagem." };
  if (tipo !== "text" && !midiaUrl) return { erro: "Informe a URL da mídia." };

  const idExt = `sim-${Date.now()}`;
  const r = await ingerirMensagemRecebida({
    telefone,
    nome,
    texto: texto || undefined,
    tipo,
    midiaUrl,
    idExterno: idExt,
    payload: { simulado: true, nome, texto, tipo, midiaUrl },
  });
  if (!r.duplicada) {
    await despacharRespostaHigia(r.conversa.id, `higia-${idExt}`);
  }

  revalidatePath("/conversas");
  return { ok: true };
}

/** Envio de teste para um número (verifica a conexão com o provedor). */
export async function testarEnvio(_prev: FormState, formData: FormData): Promise<FormState> {
  await exigirPermissao("configuracoes", "atualizar");
  const telefone = String(formData.get("telefone") ?? "").replace(/\D/g, "");
  const texto = String(formData.get("texto") ?? "").trim() || "Mensagem de teste do Espaço Flow.";
  if (!/^\d{10,13}$/.test(telefone)) return { erro: "Telefone inválido." };

  const envio = await getProvider().enviarTexto(telefone, texto);
  return envio.ok ? { ok: true } : { erro: envio.erro ?? "Falha no envio." };
}
