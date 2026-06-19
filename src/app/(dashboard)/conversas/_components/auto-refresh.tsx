"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a tela periodicamente (soft refresh do RSC) para o chat parecer "ao
 * vivo" — mensagens novas do cliente ou enviadas pelo celular aparecem sozinhas.
 * Pausa quando a aba está em segundo plano e preserva o estado dos inputs.
 */
export function AutoRefresh({ segundos = 7 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, Math.max(3, segundos) * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
