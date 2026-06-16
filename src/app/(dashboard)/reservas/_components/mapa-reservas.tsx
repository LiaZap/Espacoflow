"use client";

import { useEffect, useState, useTransition } from "react";
import { DoorOpen, Loader2 } from "lucide-react";
import { disponibilidadeSalas, type SalaDisponibilidade } from "@/lib/actions/reservas";
import { cn } from "@/lib/utils";

interface MapaReservasProps {
  data: string;
  hora: string;
  duracaoMin: number;
  value: string;
  onChange: (salaId: string) => void;
}

/** Mapa de Disponibilidade ao Vivo dentro do app: clique numa sala livre para escolher. */
export function MapaReservas({ data, hora, duracaoMin, value, onChange }: MapaReservasProps) {
  const [salas, setSalas] = useState<SalaDisponibilidade[]>([]);
  const [pendente, iniciar] = useTransition();
  const pronto = /^\d{4}-\d{2}-\d{2}$/.test(data) && /^\d{2}:\d{2}/.test(hora) && duracaoMin >= 60;

  useEffect(() => {
    if (!pronto) {
      setSalas([]);
      return;
    }
    iniciar(async () => {
      const r = await disponibilidadeSalas(data, hora, duracaoMin);
      setSalas(r);
      const sel = r.find((s) => s.id === value);
      if (sel && sel.status !== "livre") onChange("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hora, duracaoMin, pronto]);

  const livres = salas.filter((s) => s.status === "livre").length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Disponibilidade ao vivo
          </span>
        </div>
        {pendente ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : pronto ? (
          <span className="font-mono text-xs text-primary">{livres} livre(s)</span>
        ) : null}
      </div>

      {!pronto ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Escolha data, horário e duração para ver as salas livres.
        </p>
      ) : salas.length === 0 && !pendente ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma sala ativa.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {salas.map((s) => {
            const livre = s.status === "livre";
            const selecionada = s.id === value;
            return (
              <button
                type="button"
                key={s.id}
                disabled={!livre}
                onClick={() => onChange(s.id)}
                aria-pressed={selecionada}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border p-3 text-center transition-all duration-200",
                  livre
                    ? "cursor-pointer bg-success/10 ring-1 ring-success/40 hover:bg-success/20"
                    : "cursor-not-allowed bg-muted text-muted-foreground opacity-70",
                  selecionada && "bg-primary/10 ring-2 ring-primary"
                )}
              >
                <DoorOpen className={cn("h-5 w-5", livre ? "text-success" : "text-muted-foreground")} />
                <span className="text-xs font-medium">{s.nome}</span>
                <span className="font-mono text-[10px]">{livre ? "livre" : "ocupado"}</span>
              </button>
            );
          })}
        </div>
      )}

      <input type="hidden" name="sala_id" value={value} />
    </div>
  );
}
