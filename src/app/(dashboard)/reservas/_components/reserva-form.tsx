"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { criarReserva, type FormState } from "@/lib/actions/reservas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapaReservas } from "./mapa-reservas";

interface OpcaoCliente {
  id: string;
  nome: string;
  telefone: string;
}
interface OpcaoSaldo {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  pacote_nome: string;
  horas_saldo: string;
}

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const TIPOS: Array<[string, string]> = [
  ["uso_sala", "Uso de sala"],
  ["reuniao_comercial", "Reunião comercial"],
  ["tour", "Visita / tour"],
  ["assinatura_contrato", "Assinatura de contrato"],
];

function Salvar({ salaId }: { salaId: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !salaId}>
      {pending ? "Criando..." : "Criar reserva"}
    </Button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ReservaForm({
  clientes,
  saldos,
}: {
  clientes: OpcaoCliente[];
  saldos: OpcaoSaldo[];
}) {
  const [state, action] = useActionState<FormState, FormData>(criarReserva, {});
  const [clienteId, setClienteId] = useState("");
  const [salaId, setSalaId] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [duracao, setDuracao] = useState(60);

  const saldosDoCliente = useMemo(
    () => saldos.filter((s) => s.cliente_id === clienteId),
    [saldos, clienteId]
  );

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <Campo label="Cliente *">
        <select
          name="cliente_id"
          required
          className={selectClasses}
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
        >
          <option value="">Selecione…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} — {c.telefone}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Data *">
          <Input name="data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo label="Hora de início *">
          <Input name="hora" type="time" step={1800} required value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
        <Campo label="Duração (min) *">
          <Input
            name="duracao_min"
            type="number"
            min={60}
            step={30}
            required
            value={duracao}
            onChange={(e) => setDuracao(Number(e.target.value) || 60)}
          />
        </Campo>
      </div>

      <div className="space-y-1.5">
        <Label>Sala * (clique na sala livre)</Label>
        <MapaReservas data={data} hora={hora} duracaoMin={duracao} value={salaId} onChange={setSalaId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Tipo">
          <select name="tipo" className={selectClasses} defaultValue="uso_sala">
            {TIPOS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Pagar com saldo de horas (opcional)">
          <select name="pacote_cliente_id" className={selectClasses} defaultValue="">
            <option value="">Não usar saldo (PIX)</option>
            {saldosDoCliente.map((s) => (
              <option key={s.id} value={s.id}>
                {s.pacote_nome} — {s.horas_saldo}h
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Título">
        <Input name="titulo" defaultValue="Uso de sala" />
      </Campo>
      <Campo label="Notas internas">
        <Textarea name="notas_internas" />
      </Campo>

      {state?.erro ? (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Salvar salaId={salaId} />
        <Button type="button" variant="outline" asChild>
          <Link href="/reservas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
