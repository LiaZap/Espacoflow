import { listarClientes } from "@/lib/actions/clientes";
import { listarSaldosAtivos } from "@/lib/actions/pacotes";
import { PageHeader } from "@/components/page-header";
import { ReservaForm } from "../_components/reserva-form";

export default async function NovaReservaPage() {
  const [clientes, saldos] = await Promise.all([listarClientes(), listarSaldosAtivos()]);

  const clientesOpc = clientes.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone }));
  const saldosOpc = saldos.map((s) => ({
    id: s.id,
    cliente_id: s.cliente_id,
    cliente_nome: s.cliente_nome,
    pacote_nome: s.pacote_nome,
    horas_saldo: String(s.horas_saldo),
  }));

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Nova reserva"
        descricao="Escolha data e horário — o mapa mostra as salas livres em tempo real."
      />
      <ReservaForm clientes={clientesOpc} saldos={saldosOpc} />
    </div>
  );
}
