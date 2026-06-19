"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fronteira de erro do painel: transforma qualquer throw inesperado durante o
 * render (ex.: falta de permissão, hiccup de banco/infra) numa tela amigável,
 * em vez da tela de erro genérica do Next.
 */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold">Algo não carregou</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Você pode não ter acesso a esta área, ou houve uma instabilidade momentânea.
          Tente novamente ou volte ao painel.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Tentar novamente
        </Button>
        <Button asChild>
          <Link href="/dashboard">Voltar ao painel</Link>
        </Button>
      </div>
    </div>
  );
}
