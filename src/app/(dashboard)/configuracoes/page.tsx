import Link from "next/link";
import { Bot, DoorOpen, Package, ShieldCheck, MessagesSquare, ScrollText, CalendarClock, UsersRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const ITENS = [
  { href: "/configuracoes/usuarios", icon: UsersRound, titulo: "Usuários", desc: "Equipe interna, papéis e acessos (RBAC).", recurso: "usuarios" },
  { href: "/agente", icon: Bot, titulo: "Agente Hígia", desc: "Persona, prompt, preços e base de conhecimento.", recurso: "agente" },
  { href: "/salas", icon: DoorOpen, titulo: "Salas", desc: "Salas privativas e disponibilidade.", recurso: "salas" },
  { href: "/pacotes", icon: Package, titulo: "Pacotes", desc: "Catálogo de pacotes e planos.", recurso: "pacotes" },
  { href: "/painel-owner", icon: ShieldCheck, titulo: "Auditoria", desc: "Trilha de auditoria e registros excluídos.", recurso: "painel_owner" },
  { href: "/configuracoes/agenda", icon: CalendarClock, titulo: "Google Agenda", desc: "Conectar a agenda do Google para sincronizar reservas.", recurso: "configuracoes" },
  { href: "/configuracoes/lgpd", icon: ScrollText, titulo: "LGPD & DSAR", desc: "Governança de dados e solicitações de titulares.", recurso: "configuracoes" },
  { href: "/conversas", icon: MessagesSquare, titulo: "WhatsApp", desc: "Inbox e integração de mensageria (em conexão).", recurso: "conversas" },
];

export default async function ConfiguracoesPage() {
  const session = await getSession();
  const itens = session
    ? ITENS.filter((i) => temPermissao(session.role, i.recurso, "ler"))
    : [];
  return (
    <div className="space-y-6 p-8">
      <PageHeader titulo="Configurações" descricao="Ajustes do Espaço Flow." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((i) => {
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
