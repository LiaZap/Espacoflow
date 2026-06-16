import Link from "next/link";
import { CalendarDays, MessagesSquare, BadgeDollarSign, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { obterKpis } from "@/lib/actions/dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await getSession();
  const kpis = await obterKpis();
  const primeiroNome = session?.nome?.split(" ")[0] ?? "";

  const cards = [
    { titulo: "Reservas hoje", valor: kpis.reservasHoje, icon: CalendarDays, href: "/reservas" },
    { titulo: "Conversas abertas", valor: kpis.conversasAbertas, icon: MessagesSquare, href: "/conversas" },
    { titulo: "PIX pendentes", valor: kpis.pixPendentes, icon: BadgeDollarSign, href: "/pagamentos" },
    { titulo: "Clientes", valor: kpis.clientesTotal, icon: Users, href: "/clientes" },
  ];

  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {primeiroNome} 👋</h1>
        <p className="mt-1 text-muted-foreground">Visão geral do Espaço Flow.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.titulo} href={c.href}>
              <Card className="transition-colors hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.titulo}</CardTitle>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{c.valor}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {session && (session.role === "owner" || session.role === "admin" || session.role === "super_admin") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administração</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            <Link className="text-primary hover:underline" href="/painel-owner">
              Painel Owner (auditoria & registros excluídos)
            </Link>
            <Link className="text-primary hover:underline" href="/agente">
              Configurar Hígia
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
