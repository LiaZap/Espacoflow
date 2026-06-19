import { NextResponse } from "next/server";
import { normalizarEvolution, ingerirMensagemRecebida } from "@/lib/whatsapp/ingestao";
import { despacharRespostaHigia } from "@/lib/fila/dispatch";
import { salvarEstadoWhatsapp } from "@/lib/mongo/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenValido(req: Request): boolean {
  const esperado = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  // Sem token configurado: liberado em dev, BLOQUEADO em produção (fail-closed).
  if (!esperado) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const recebido = req.headers.get("x-webhook-token") ?? url.searchParams.get("token");
  return recebido === esperado;
}

/** Handshake de verificação do Meta Cloud (hub.challenge). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

/** Recebe eventos do provedor (Evolution API). */
export async function POST(req: Request) {
  if (!tokenValido(req)) {
    return NextResponse.json({ erro: "token inválido" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400 });
  }

  // Eventos de conexão/QR da Evolution (não são mensagens).
  const evento = String((payload as { event?: string }).event ?? "");
  const instancia = String((payload as { instance?: string }).instance ?? "");
  if (evento === "qrcode.updated") {
    const data = (payload as { data?: { qrcode?: { base64?: string }; base64?: string } }).data ?? {};
    await salvarEstadoWhatsapp(instancia, {
      qr_base64: data.qrcode?.base64 ?? data.base64 ?? null,
      estado: "connecting",
    });
    return NextResponse.json({ ok: true });
  }
  if (evento === "connection.update") {
    const estado = String((payload as { data?: { state?: string } }).data?.state ?? "");
    const dados: Record<string, unknown> = { estado };
    if (estado === "open") dados.qr_base64 = null;
    await salvarEstadoWhatsapp(instancia, dados);
    return NextResponse.json({ ok: true });
  }

  // Só mensagens novas viram conversa. Eventos como messages.update (ACK de
  // leitura/entrega), send.message e presence trazem data.key e, sem este filtro,
  // virariam "mensagem" fantasma (conteúdo null) e acionariam a Hígia à toa.
  if (evento && evento !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignorado: evento });
  }

  const normalizada = normalizarEvolution(payload);
  if (!normalizada) return NextResponse.json({ ok: true, ignorado: true });

  const r = await ingerirMensagemRecebida(normalizada);
  if (r.duplicada) return NextResponse.json({ ok: true, duplicada: true });

  // Enfileira (ou processa inline) a resposta da Hígia, idempotente por id_externo.
  const chave = normalizada.idExterno ? `higia-${normalizada.idExterno}` : undefined;
  await despacharRespostaHigia(r.conversa.id, chave);

  return NextResponse.json({ ok: true });
}
