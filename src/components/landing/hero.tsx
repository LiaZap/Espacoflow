"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveMap } from "./live-map";
import { Counter } from "./motion";
import { linkWhatsapp } from "@/lib/landing";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export function LandingHero() {
  const wa = linkWhatsapp("Olá! Gostaria de agendar uma visita ao Espaço Flow.");

  return (
    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
      <div className="container relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"
          >
            <MapPin className="h-3 w-3" /> Sudoeste, Brasília – DF
          </motion.span>
          <motion.h1
            variants={item}
            className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Um lugar para <span className="text-primary">pertencer</span> e produzir.
          </motion.h1>
          <motion.p variants={item} className="mt-5 max-w-xl text-lg text-muted-foreground">
            Salas privativas climatizadas com isolamento acústico, Wi-Fi e recepção — das 07h às 23h,
            todos os dias. O melhor custo-benefício do Sudoeste.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <a href={wa} target="_blank" rel="noreferrer">Agendar visita</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#planos">Ver planos</a>
            </Button>
          </motion.div>
          <motion.div variants={item} className="mt-10 flex flex-wrap gap-8">
            <Stat n={4} suf="" label="salas privativas" />
            <Stat n={16} suf="h" label="por dia (07–23h)" />
            <Stat n={7} suf="" label="dias na semana" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        >
          <LiveMap />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ n, suf, label }: { n: number; suf: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-bold text-foreground">
        <Counter to={n} suffix={suf} />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
