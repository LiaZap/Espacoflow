import Link from "next/link";
import { Bot, DoorOpen, Package, ShieldCheck, MessagesSquare, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const ITENS = [
  { href: "/agente", icon: Bot, titulo: "Agente Hígia", desc: "Persona, prompt, preços e base de conhecimento." },
  { href: "/salas", icon: DoorOpen, titulo: "Salas", desc: "Salas privativas e disponibilidade." },
  { href: "/pacotes", icon: Package, titulo: "Pacotes", desc: "Catálogo de pacotes e planos." },
  { href: "/painel-owner", icon: ShieldCheck, titulo: "Auditoria", desc: "Trilha de auditoria e registros excluídos." },
  { href: "/configuracoes/lgpd", icon: ScrollText, titulo: "LGPD & DSAR", desc: "Governança de dados e solicitações de titulares." },
  { href: "/conversas", icon: MessagesSquare, titulo: "WhatsApp", desc: "Inbox e integração de mensageria (em conexão)." },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="Configurações" descricao="Ajustes do Espaço Flow." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITENS.map((i) => {
          const Icon = i.icon;
          return (
            <Link key={i.href} href={i.href}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{i.titulo}</CardTitle>
                  <CardDescription>{i.desc}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
