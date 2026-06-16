import { JORNADA_MIN } from "@/lib/reservas/disponibilidade";
import type { OcupacaoSala } from "@/lib/actions/reservas";
import { cn } from "@/lib/utils";

const HORAS = [7, 9, 11, 13, 15, 17, 19, 21, 23];
const STATUS_COR: Record<string, string> = {
  pendente: "bg-warning/80 text-warning-foreground",
  confirmada: "bg-primary text-primary-foreground",
  concluida: "bg-success text-success-foreground",
};

export function OcupacaoBoard({ salas, nowMin }: { salas: OcupacaoSala[]; nowMin: number | null }) {
  const mostrarAgora = nowMin !== null && nowMin >= 0 && nowMin <= JORNADA_MIN;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 ml-28 hidden justify-between font-mono text-[10px] text-muted-foreground sm:flex">
        {HORAS.map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}h</span>
        ))}
      </div>

      <div className="space-y-2">
        {salas.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-24 shrink-0 truncate text-sm font-medium sm:w-28">{s.nome}</div>
            <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-muted/60">
              {HORAS.slice(1, -1).map((h) => (
                <div
                  key={h}
                  className="absolute top-0 h-full border-l border-border/60"
                  style={{ left: `${((h * 60 - 7 * 60) / JORNADA_MIN) * 100}%` }}
                />
              ))}

              {mostrarAgora ? (
                <div
                  className="absolute top-0 z-10 h-full w-0.5 bg-accent"
                  style={{ left: `${((nowMin as number) / JORNADA_MIN) * 100}%` }}
                />
              ) : null}

              {s.reservas.map((r) => {
                const left = (r.inicioMin / JORNADA_MIN) * 100;
                const width = Math.max(2.5, ((r.fimMin - r.inicioMin) / JORNADA_MIN) * 100);
                return (
                  <div
                    key={r.id}
                    title={`${r.cliente} • ${r.hora} • ${r.duracaoMin}min • ${r.status}`}
                    className={cn(
                      "absolute bottom-1 top-1 flex items-center overflow-hidden rounded px-1.5 text-[10px] font-medium",
                      STATUS_COR[r.status] ?? "bg-primary text-primary-foreground"
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="truncate">{r.cliente}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Leg cor="bg-warning/80" t="Pendente" />
        <Leg cor="bg-primary" t="Confirmada" />
        <Leg cor="bg-success" t="Concluída" />
        {mostrarAgora ? <Leg cor="bg-accent" t="Agora" /> : null}
      </div>
    </div>
  );
}

function Leg({ cor, t }: { cor: string; t: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-2 w-3 rounded", cor)} />
      {t}
    </span>
  );
}
