/**
 * Sincronização reserva → Google Calendar (best-effort: nunca quebra a reserva).
 * Usa os tokens salvos em google_agenda_config; renova o access_token quando expira.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { googleAgendaConfig } from "@/lib/db/schema/integracoes";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { agenteConfig } from "@/lib/db/schema/agente";
import { registrarAuditoria } from "@/lib/audit/logger";
import { googleConfigurado } from "./oauth";
import type { GoogleAgendaConfig } from "@/lib/db/schema/integracoes";

/** Registra (auditoria) por que uma reserva CONFIRMADA não entrou na agenda. */
async function avisarSyncFalhou(reservaId: string, motivo: string): Promise<void> {
  await registrarAuditoria({
    acao: "atualizar",
    entidade: "reservas",
    registroId: reservaId,
    severidade: "warn",
    detalhes: `Reserva confirmada NÃO foi para a Google Agenda: ${motivo}.`,
  }).catch(() => undefined);
}

/** Diagnóstico do gate de sincronização (para /api/health e painel). Não expõe tokens. */
export async function diagnosticoGoogleAgenda(): Promise<{
  configurado: boolean;
  conectado: boolean;
  sincronizar: boolean;
  tem_refresh_token: boolean;
  conta_email: string | null;
  calendar_id: string | null;
}> {
  const c = await carregarConfig();
  return {
    configurado: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    conectado: Boolean(c?.conectado),
    sincronizar: Boolean(c?.sincronizar),
    tem_refresh_token: Boolean(c?.refresh_token),
    conta_email: c?.conta_email ?? null,
    calendar_id: c?.calendar_id ?? null,
  };
}

async function carregarConfig(): Promise<GoogleAgendaConfig | null> {
  const [c] = await db
    .select()
    .from(googleAgendaConfig)
    .where(eq(googleAgendaConfig.is_deleted, false))
    .limit(1);
  return c ?? null;
}

function prontaParaSync(c: GoogleAgendaConfig | null): c is GoogleAgendaConfig {
  return Boolean(c?.conectado && c?.sincronizar && c?.refresh_token);
}

/** Por que o gate de sincronização barrou (mensagem para auditoria). */
function motivoNaoPronta(c: GoogleAgendaConfig | null): string {
  if (!c?.conectado) return "Google Agenda não conectado";
  if (!c.sincronizar) return "sincronização desligada nas Configurações";
  return "sem refresh_token (reconecte a conta Google)";
}

/** Access token válido (renova via refresh_token se expirado). */
async function accessTokenValido(c: GoogleAgendaConfig): Promise<string | null> {
  const margem = 60_000;
  if (c.access_token && c.token_expira_em && c.token_expira_em.getTime() - Date.now() > margem) {
    return c.access_token;
  }
  if (!c.refresh_token) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: c.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      }),
    });
    if (!res.ok) return null;
    const t = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };
    const expira = new Date(Date.now() + (t.expires_in ?? 3600) * 1000);
    await db
      .update(googleAgendaConfig)
      .set({
        access_token: t.access_token,
        token_expira_em: expira,
        // O Google pode rotacionar o refresh_token; se vier um novo, persiste.
        ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
        updated_at: new Date(),
      })
      .where(eq(googleAgendaConfig.id, c.id));
    return t.access_token;
  } catch {
    return null;
  }
}

function eventosUrl(calendarId: string, eventId?: string): string {
  const cal = encodeURIComponent(calendarId || "primary");
  const base = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

/** Cria ou atualiza o evento da reserva no Google Calendar. Best-effort. */
export async function sincronizarReserva(reservaId: string): Promise<void> {
  try {
    const [r] = await db.select().from(reservas).where(eq(reservas.id, reservaId)).limit(1);
    if (!r || r.is_deleted || !r.inicio_em || !r.fim_em) return;

    const cfg = await carregarConfig();
    if (r.status_reserva === "cancelada" || r.status_reserva === "no_show") {
      await removerEventoReserva(reservaId);
      return;
    }
    // Só reservas CONFIRMADAS/concluídas entram na agenda. Provisórias (pendentes de
    // Pix) não viram evento — e isso é normal, não registramos.
    if (r.status_reserva !== "confirmada" && r.status_reserva !== "concluida") return;

    // A partir daqui a reserva DEVERIA virar evento. Se o gate barrar ou o token
    // falhar, registramos o motivo (em vez de falhar em silêncio) para diagnóstico.
    if (!prontaParaSync(cfg)) {
      await avisarSyncFalhou(reservaId, motivoNaoPronta(cfg));
      return;
    }
    const token = await accessTokenValido(cfg);
    if (!token) {
      // Distingue o caso clássico: o WORKER (serviço separado) está sem as credenciais
      // GOOGLE_* no env, então não consegue renovar o token — o sync manual (no WEB,
      // que tem as credenciais) funciona, mas o automático (no worker) não.
      await avisarSyncFalhou(
        reservaId,
        googleConfigurado()
          ? "não foi possível renovar o token do Google (refresh rejeitado — reconecte a conta)"
          : "credenciais do Google ausentes NESTE serviço — defina GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (provavelmente faltam no worker)"
      );
      return;
    }

    const [sala] = await db.select({ nome: salas.nome }).from(salas).where(eq(salas.id, r.sala_id));
    const [cli] = await db
      .select({ nome: clientes.nome, telefone: clientes.telefone })
      .from(clientes)
      .where(eq(clientes.id, r.cliente_id));
    const [ag] = await db.select({ tz: agenteConfig.timezone }).from(agenteConfig).limit(1);
    const timeZone = ag?.tz || "America/Sao_Paulo";

    const evento = {
      summary: `${r.titulo}${sala?.nome ? ` — ${sala.nome}` : ""}`,
      description: [
        cli?.nome ? `Cliente: ${cli.nome}` : null,
        cli?.telefone ? `Telefone: ${cli.telefone}` : null,
        `Status: ${r.status_reserva}`,
        `Reserva: ${r.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: r.inicio_em.toISOString(), timeZone },
      end: { dateTime: r.fim_em.toISOString(), timeZone },
    };

    const temId = Boolean(r.google_event_id);
    const res = await fetch(eventosUrl(cfg.calendar_id, r.google_event_id ?? undefined), {
      method: temId ? "PATCH" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(evento),
    });

    // Evento sumiu no Google (404 num PATCH) → recria.
    if (!res.ok) {
      if (temId && res.status === 404) {
        const res2 = await fetch(eventosUrl(cfg.calendar_id), {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(evento),
        });
        if (res2.ok) {
          const ev = (await res2.json()) as { id?: string };
          if (ev.id) await db.update(reservas).set({ google_event_id: ev.id }).where(eq(reservas.id, r.id));
          return;
        }
        // Recriação também falhou: loga o status REAL da recriação (não o 404 do PATCH).
        await avisarSyncFalhou(reservaId, `evento sumiu no Google e a recriação falhou (HTTP ${res2.status})`);
        return;
      }
      await avisarSyncFalhou(reservaId, `erro HTTP ${res.status} ao gravar o evento`);
      return;
    }

    const ev = (await res.json()) as { id?: string };
    if (ev.id && ev.id !== r.google_event_id) {
      await db.update(reservas).set({ google_event_id: ev.id }).where(eq(reservas.id, r.id));
    }
  } catch {
    // best-effort: a reserva nunca falha por causa da agenda
  }
}

/** Remove o evento da reserva no Calendar (ao cancelar). Best-effort. */
export async function removerEventoReserva(reservaId: string): Promise<void> {
  try {
    const cfg = await carregarConfig();
    if (!cfg?.conectado || !cfg.refresh_token) return;
    const [r] = await db.select().from(reservas).where(eq(reservas.id, reservaId)).limit(1);
    if (!r?.google_event_id) return;
    const token = await accessTokenValido(cfg);
    if (!token) return;
    await fetch(eventosUrl(cfg.calendar_id, r.google_event_id), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    await db.update(reservas).set({ google_event_id: null }).where(eq(reservas.id, r.id));
  } catch {
    // best-effort
  }
}
