import { cn } from "@/lib/utils";

export interface Serie {
  label: string;
  valor: number;
}

/** Gráfico de barras verticais (série temporal). */
export function BarChart({
  dados,
  formato,
}: {
  dados: Serie[];
  formato?: (v: number) => string;
}) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="flex h-44 items-end gap-1">
      {dados.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="font-mono text-[9px] text-muted-foreground">
            {d.valor > 0 ? (formato ? formato(d.valor) : d.valor) : ""}
          </span>
          <div
            className="w-full rounded-t bg-primary/85"
            style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor > 0 ? "4px" : "0" }}
            title={`${d.label}: ${formato ? formato(d.valor) : d.valor}`}
          />
          <span className="font-mono text-[9px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Barras horizontais (ranking/categoria). */
export function RankBars({ dados, cor = "bg-accent" }: { dados: Serie[]; cor?: string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="space-y-2.5">
      {dados.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-muted-foreground">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", cor)} style={{ width: `${(d.valor / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-xs">{d.valor}</span>
        </div>
      ))}
    </div>
  );
}
