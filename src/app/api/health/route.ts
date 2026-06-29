import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marcador de versão para conferir, em produção, QUAL build está no ar.
// Atualize a cada release relevante (ou injete APP_VERSION no ambiente).
const VERSION = process.env.APP_VERSION || "higia-uat-r02b-holds24h-regras-2026-06-29";

/** Healthcheck + versão. GET /api/health → { ok, version }. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    version: VERSION,
    // Marcos que devem estar presentes nesta versão (sanity da Hígia):
    higia: {
      pix_chave_em_mensagem_separada: true,
      confirma_no_comprovante_sem_equipe: true,
      agenda_sozinha_sem_handoff: true,
      preco_por_dia_4h_meia_diaria: true,
    },
  });
}
