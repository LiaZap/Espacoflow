import { NextResponse } from "next/server";
import { APP_VERSION as VERSION } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
