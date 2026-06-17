"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  statusWhatsapp,
  conectarWhatsapp,
  desconectarWhatsapp,
  type StatusWhatsapp,
} from "@/lib/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ConexaoWhatsapp() {
  const [st, setSt] = useState<StatusWhatsapp>({
    configurado: false,
    conectado: false,
    estado: "…",
    qr: null,
  });
  const [pendente, iniciar] = useTransition();

  const atualizar = useCallback(async () => {
    setSt(await statusWhatsapp());
  }, []);

  useEffect(() => {
    atualizar();
  }, [atualizar]);

  // Enquanto não conectado, faz polling (pega o QR/estado que chegam pelo webhook).
  useEffect(() => {
    if (!st.configurado || st.conectado) return;
    const id = setInterval(atualizar, 4000);
    return () => clearInterval(id);
  }, [st.configurado, st.conectado, atualizar]);

  function conectar() {
    iniciar(async () => {
      const r = await conectarWhatsapp();
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success("Gerando QR Code… aguarde aparecer.");
        atualizar();
      }
    });
  }

  function desconectar() {
    iniciar(async () => {
      const r = await desconectarWhatsapp();
      if (r?.erro) toast.error(r.erro);
      else {
        toast.success("WhatsApp desconectado.");
        atualizar();
      }
    });
  }

  const variante = st.conectado ? "success" : st.estado === "connecting" ? "warning" : "secondary";
  const rotulo = !st.configurado ? "sem configuração" : st.conectado ? "conectado" : st.estado;
  const qrSrc = st.qr ? (st.qr.startsWith("data:") ? st.qr : `data:image/png;base64,${st.qr}`) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Status:</span>
        <Badge variant={variante}>{rotulo}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={atualizar} disabled={pendente}>
            Atualizar
          </Button>
          {st.conectado ? (
            <Button size="sm" variant="destructive" onClick={desconectar} disabled={pendente}>
              Desconectar
            </Button>
          ) : (
            <Button size="sm" onClick={conectar} disabled={pendente || !st.configurado}>
              Conectar
            </Button>
          )}
        </div>
      </div>

      {!st.configurado ? (
        <p className="text-sm text-muted-foreground">
          Configure <code>WHATSAPP_API_URL</code>, <code>WHATSAPP_API_TOKEN</code> e{" "}
          <code>WHATSAPP_INSTANCIA</code> (Evolution) no ambiente.
        </p>
      ) : st.conectado ? (
        <p className="text-sm text-success">WhatsApp conectado e pronto. ✅</p>
      ) : qrSrc ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            No WhatsApp do número → <b>Aparelhos conectados</b> → <b>Conectar aparelho</b> → escaneie:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="QR Code do WhatsApp" className="h-56 w-56 rounded" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Clique em <b>Conectar</b> para gerar o QR Code (aparece em alguns segundos).
        </p>
      )}
    </div>
  );
}
