import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { clientes } from "@/lib/db/schema/clientes";
import { documentosVersoes } from "@/lib/db/schema/documentos";
import { uploadArquivo, minioConfigurado } from "@/lib/storage/minio";
import { formatarBRL, formatarDataHora } from "@/lib/utils";

async function gerarReciboPdf(p: {
  numero: string;
  cliente: string;
  descricao: string;
  valor: string;
  data: string;
  versao: number;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const verde = rgb(0.078, 0.275, 0.231);
  const cinza = rgb(0.45, 0.45, 0.45);

  let y = 780;
  page.drawText("Espaço Flow — Coworking", { x: 50, y, size: 20, font: bold, color: verde });
  y -= 18;
  page.drawText("Sudoeste, Brasília – DF  ·  Felipe Geraldo Torres LTDA", {
    x: 50,
    y,
    size: 10,
    font: fonte,
    color: cinza,
  });
  y -= 46;
  page.drawText("RECIBO DE PAGAMENTO", { x: 50, y, size: 14, font: bold });
  page.drawText(`v${p.versao}`, { x: 510, y, size: 11, font: fonte, color: cinza });
  y -= 30;

  const linha = (k: string, v: string) => {
    page.drawText(k, { x: 50, y, size: 11, font: bold });
    page.drawText(v, { x: 200, y, size: 11, font: fonte });
    y -= 24;
  };
  linha("Número:", p.numero);
  linha("Cliente:", p.cliente);
  linha("Referente a:", p.descricao);
  linha("Valor:", p.valor);
  linha("Data:", p.data);
  linha("Forma de pagamento:", "Pix");

  y -= 24;
  page.drawText("Documento gerado eletronicamente pelo sistema do Espaço Flow.", {
    x: 50,
    y,
    size: 9,
    font: fonte,
    color: cinza,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Gera o recibo (PDF), sobe no MinIO e registra a versão em documentos_versoes. */
export async function emitirRecibo(
  pagamentoId: string,
  geradoPor?: string | null
): Promise<{ erro?: string; url?: string }> {
  if (!minioConfigurado()) return { erro: "Storage (MinIO) não configurado no servidor." };

  const [pg] = await db
    .select()
    .from(pagamentos)
    .where(and(eq(pagamentos.id, pagamentoId), eq(pagamentos.is_deleted, false)));
  if (!pg) return { erro: "Pagamento não encontrado." };

  const [cli] = await db.select().from(clientes).where(eq(clientes.id, pg.cliente_id));

  const [ultima] = await db
    .select({ versao: documentosVersoes.versao })
    .from(documentosVersoes)
    .where(
      and(
        eq(documentosVersoes.entidade, "pagamento"),
        eq(documentosVersoes.entidade_id, pagamentoId),
        eq(documentosVersoes.is_deleted, false)
      )
    )
    .orderBy(desc(documentosVersoes.versao))
    .limit(1);
  const versao = (ultima?.versao ?? 0) + 1;

  const buffer = await gerarReciboPdf({
    numero: pagamentoId.slice(0, 8).toUpperCase(),
    cliente: cli?.nome ?? "—",
    descricao: pg.reserva_id ? "Reserva de sala" : pg.cliente_pacote_id ? "Pacote de horas" : "Pagamento",
    valor: pg.valor ? formatarBRL(Math.round(Number(pg.valor) * 100)) : "—",
    data: formatarDataHora(pg.pago_em ?? pg.created_at),
    versao,
  });

  const chave = `recibos/${pagamentoId}-v${versao}.pdf`;
  const url = await uploadArquivo(chave, buffer, "application/pdf");

  await db.insert(documentosVersoes).values({
    tipo: "recibo",
    entidade: "pagamento",
    entidade_id: pagamentoId,
    versao,
    arquivo_url: url,
    gerado_por: geradoPor ?? null,
  });

  return { url };
}
