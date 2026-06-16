"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// 0 = livre · 1 = reservado (por mim) · 2 = ocupado
const PLANTA = [2, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0, 0];
const COR = [
  "bg-success/15 ring-success/40 text-success",
  "bg-accent/20 ring-accent/60 text-accent-foreground",
  "bg-muted ring-border text-muted-foreground",
];

export function LiveMap() {
  const livres = PLANTA.filter((s) => s === 0).length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-lg sm:p-5">
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
        <span className="font-mono text-xs text-muted-foreground">Sudoeste · agora</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PLANTA.map((estado, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md ring-1",
              COR[estado],
              estado === 0 && "animate-glow-pulse"
            )}
          >
            <span className="font-mono text-[10px]">{i + 1}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <Legenda cor="bg-success" txt="Livre" />
          <Legenda cor="bg-accent" txt="Reservado" />
          <Legenda cor="bg-muted-foreground/40" txt="Ocupado" />
        </div>
        <span className="font-mono text-sm font-semibold text-primary">{livres} lugares livres</span>
      </div>
    </div>
  );
}

function Legenda({ cor, txt }: { cor: string; txt: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-2 w-2 rounded-full", cor)} />
      {txt}
    </span>
  );
}
