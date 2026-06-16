import { ocupacaoDoDia } from "@/lib/actions/reservas";
import { ABRE_MIN } from "@/lib/reservas/disponibilidade";
import { PageHeader } from "@/components/page-header";
import { OcupacaoBoard } from "../_components/ocupacao-board";
import { SeletorData } from "../_components/seletor-data";

function hojeSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default async function OcupacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const sp = await searchParams;
  const hoje = hojeSaoPaulo();
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hoje;
  const salas = await ocupacaoDoDia(data);

  let nowMin: number | null = null;
  if (data === hoje) {
    const agora = new Date().toLocaleTimeString("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    const partes = agora.split(":");
    nowMin = Number(partes[0]) * 60 + Number(partes[1] ?? 0) - ABRE_MIN;
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Ocupação do dia"
        descricao="Uso das salas das 07h às 23h. A linha indica o horário atual."
        acao={<SeletorData data={data} />}
      />
      <OcupacaoBoard salas={salas} nowMin={nowMin} />
    </div>
  );
}
