"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RelatoriosControles({
  de,
  ate,
  cliente,
  clientes,
}: {
  de: string;
  ate: string;
  cliente: string;
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [d1, setD1] = useState(de);
  const [d2, setD2] = useState(ate);
  const [cli, setCli] = useState(cliente);

  function aplicar() {
    const p = new URLSearchParams();
    if (d1) p.set("de", d1);
    if (d2) p.set("ate", d2);
    if (cli) p.set("cliente", cli);
    router.push(`/relatorios?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 print:hidden">
      <div className="space-y-1.5">
        <Label>De</Label>
        <Input type="date" value={d1} onChange={(e) => setD1(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1.5">
        <Label>Até</Label>
        <Input type="date" value={d2} onChange={(e) => setD2(e.target.value)} className="w-40" />
      </div>
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label>Cliente (opcional)</Label>
        <select value={cli} onChange={(e) => setCli(e.target.value)} className={selectClasses}>
          <option value="">Todos (visão geral)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <Button type="button" onClick={aplicar}>
        <Filter className="h-4 w-4" /> Aplicar
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Imprimir
      </Button>
    </div>
  );
}
