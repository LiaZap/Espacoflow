import { NextResponse } from "next/server";
import { APP_VERSION as VERSION } from "@/lib/version";
import { diagnosticoGoogleAgenda } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Healthcheck + versão. GET /api/health → { ok, version, higia, google }. */
export async function GET() {
  // Diagnóstico do Google Agenda (não falha o health se o banco estiver fora).
  const google = await diagnosticoGoogleAgenda().catch(() => null);
  return NextResponse.json({
    ok: true,
    version: VERSION,
    // Marcos que devem estar presentes nesta versão (sanity da Hígia):
    higia: {
      pix_chave_em_mensagem_separada: true,
      confirma_no_comprovante_sem_equipe: true,
      agenda_sozinha_sem_handoff: true,
      preco_por_dia_4h_meia_diaria: true,
      qualifica_e_aceite_antes_de_agendar: true,
      roteia_psicologo_sala_sem_mesa: true,
    },
    // Por que uma reserva confirmada pode não aparecer na agenda: confira aqui.
    google,
  });
}
