"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatarDataHora } from "@/lib/utils";

export type MovimentoSaldo = {
  id: string;
  tipo: string;
  horas: string;
  saldo_apos: string;
  motivo: string | null;
  created_at: string;
};
export type SaldoAtivo = {
  id: string;
  cliente_nome: string;
  pacote_nome: string;
  horas_saldo: string;
  valido_ate: string;
  movimentos: MovimentoSaldo[];
};

const ROTULO: Record<string, string> = { compra: "Compra", debito: "Uso", credito: "Devolução" };

/**
 * Lista de saldos ativos com HISTÓRICO expansível (seta pra baixo). Cada linha abre o
 * extrato de movimentos do pacote (compra, uso em reserva, devolução por cancelamento/ajuste)
 * pra a equipe acompanhar como o saldo de horas evoluiu.
 */
export function SaldosAtivos({ saldos }: { saldos: SaldoAtivo[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  if (saldos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum saldo ativo.</p>;
  }
  return (
    <ul className="divide-y text-sm">
      {saldos.map((s) => {
        const open = aberto === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setAberto(open ? null : s.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 py-2 text-left transition-colors hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
                <span>
                  {s.cliente_nome} — <span className="text-muted-foreground">{s.pacote_nome}</span>
                </span>
              </span>
              <span className="font-medium">
                {s.horas_saldo}h até {s.valido_ate}
              </span>
            </button>

            {open && (
              <div className="pb-3 pl-6">
                {s.movimentos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem movimentações ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Quando</th>
                          <th className="py-1 pr-3 font-medium">Tipo</th>
                          <th className="py-1 pr-3 text-right font-medium">Horas</th>
                          <th className="py-1 pr-3 text-right font-medium">Saldo</th>
                          <th className="py-1 font-medium">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.movimentos.map((m) => {
                          const saida = m.tipo === "debito";
                          return (
                            <tr key={m.id} className="border-t">
                              <td className="whitespace-nowrap py-1 pr-3 text-muted-foreground">
                                {formatarDataHora(m.created_at)}
                              </td>
                              <td className="py-1 pr-3">
                                <Badge variant={saida ? "secondary" : "success"}>{ROTULO[m.tipo] ?? m.tipo}</Badge>
                              </td>
                              <td className={`py-1 pr-3 text-right font-medium ${saida ? "text-red-600" : "text-green-700"}`}>
                                {saida ? "−" : "+"}
                                {Number(m.horas)}h
                              </td>
                              <td className="py-1 pr-3 text-right text-muted-foreground">{m.saldo_apos}h</td>
                              <td className="py-1 text-muted-foreground">{m.motivo ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
