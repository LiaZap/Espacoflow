"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ESPACOS } from "@/lib/landing";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function EspacosGallery() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ESPACOS.map((e, i) => (
        <Foto key={e.src} src={e.src} titulo={e.titulo} desc={e.desc} index={i} />
      ))}
    </div>
  );
}

function Foto({
  src,
  titulo,
  desc,
  index,
}: {
  src: string;
  titulo: string;
  desc: string;
  index: number;
}) {
  const [erro, setErro] = useState(false);
  if (erro) return null; // foto ainda não adicionada → não renderiza

  return (
    <motion.figure
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: EASE, delay: (index % 3) * 0.06 }}
      className="group overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={src}
          alt={titulo}
          loading="lazy"
          decoding="async"
          onError={() => setErro(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <figcaption className="p-4">
        <h3 className="font-medium">{titulo}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </figcaption>
    </motion.figure>
  );
}
