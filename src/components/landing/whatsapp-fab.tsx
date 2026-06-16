import { MessageCircle } from "lucide-react";
import { linkWhatsapp } from "@/lib/landing";

export function WhatsappFab() {
  return (
    <a
      href={linkWhatsapp("Olá! Vim pelo site e gostaria de saber sobre as salas do Espaço Flow.")}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-success px-5 py-3 font-medium text-success-foreground shadow-lg transition-transform hover:scale-105"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
    </a>
  );
}
