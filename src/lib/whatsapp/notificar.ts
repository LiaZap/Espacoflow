import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig } from "@/lib/db/schema/agente";
import { jobsFila } from "@/lib/db/schema/jobs";
import { getProvider } from "./provider";

/**
 * Avisa a EQUIPE no WhatsApp (agente_config.telefone_notificacao). Best-effort: nunca lança.
 * Passando `chave`, o alerta é deduplicado pelo índice único de jobs_fila.idempotency_key —
 * assim a mesma situação não vira mensagem repetida a cada varredura.
 */
export async function notificarEquipe(texto: string, chave?: string): Promise<boolean> {
  if (chave) {
    const claim = await db
      .insert(jobsFila)
      .values({ tipo: "alerta-equipe", status: "concluido", processado_em: new Date(), idempotency_key: chave })
      .onConflictDoNothing()
      .returning({ id: jobsFila.id })
      .catch(() => [] as { id: string }[]);
    if (claim.length === 0) return false; // já alertado
  }
  const [cfg] = await db
    .select({ tel: agenteConfig.telefone_notificacao })
    .from(agenteConfig)
    .where(eq(agenteConfig.is_deleted, false))
    .limit(1);
  const notif = (cfg?.tel ?? "").replace(/\D/g, "");
  if (!notif) return false; // sem número configurado em /agente → no-op
  const r = await getProvider()
    .enviarTexto(notif, texto)
    .catch(() => ({ ok: false }));
  return r.ok;
}

type LinhaMuda = { conversa_id: string; status: string; nome: string | null; telefone: string | null; ult_cliente: string };

/**
 * REDE DE GARANTIA contra silêncio: acha mensagens de CLIENTE sem nenhuma resposta ENTREGUE
 * depois delas há mais de `limiteMin` minutos e avisa a equipe (um alerta por caso).
 * Olha o RESULTADO, não a causa — cobre conversa presa em "humano", worker fora do ar, erro
 * definitivo do LLM, resposta vazia, falha do provedor e job na DLQ de uma só vez.
 */
export async function varrerSilencio(limiteMin = 10): Promise<{ alertados: number; casos: number }> {
  const linhas = (await db.execute(sql`
    select c.id::text as conversa_id, c.status, cl.nome, cl.telefone,
           max(case when m.origem = 'user' then m.created_at end) as ult_cliente
      from whatsapp_conversas c
      join clientes cl on cl.id = c.cliente_id
      join whatsapp_mensagens m on m.conversa_id = c.id and m.is_deleted = false
     where c.is_deleted = false
     group by c.id, c.status, cl.nome, cl.telefone
    having max(case when m.origem = 'user' then m.created_at end) > coalesce(
             max(case when m.origem <> 'user' and m.status <> 'failed' then m.created_at end),
             timestamp 'epoch')
       and max(case when m.origem = 'user' then m.created_at end) < now() - make_interval(mins => ${limiteMin})
       and max(case when m.origem = 'user' then m.created_at end) > now() - interval '12 hours'
  `)) as unknown as LinhaMuda[];

  let alertados = 0;
  for (const r of linhas) {
    const minuto = Math.floor(new Date(r.ult_cliente).getTime() / 60_000);
    const ok = await notificarEquipe(
      `🚨 Cliente SEM RESPOSTA há ${limiteMin}+ min\n` +
        `${r.nome ?? r.telefone ?? "?"}${r.telefone ? ` (${r.telefone})` : ""}\n` +
        `Status da conversa: ${r.status}\nAbra o painel em Conversas e responda.`,
      `alerta-silencio-${r.conversa_id}-${minuto}`
    );
    if (ok) alertados += 1;
  }
  return { alertados, casos: linhas.length };
}
