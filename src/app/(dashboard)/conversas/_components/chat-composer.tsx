"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";
import { enviarMensagemManual } from "@/lib/actions/conversas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Campo de resposta do atendente — envia a mensagem ao cliente pelo WhatsApp
 * (enviarMensagemManual) e assume a conversa como "humano". Enter envia;
 * Shift+Enter quebra linha.
 */
export function ChatComposer({ id }: { id: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, iniciar] = useTransition();

  function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    iniciar(async () => {
      const r = await enviarMensagemManual(id, t);
      if (r?.erro) {
        toast.error(r.erro);
      } else {
        setTexto("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-end gap-2 border-t bg-background p-3">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }}
        placeholder="Escreva uma resposta ao cliente…  (Enter envia, Shift+Enter quebra linha)"
        rows={1}
        className="max-h-32 min-h-[44px] flex-1 resize-none"
      />
      <Button onClick={enviar} disabled={enviando || !texto.trim()} size="icon" aria-label="Enviar">
        <SendHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}
