"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  CalendarDays,
  Users,
  Package,
  DoorOpen,
  Bot,
  Images,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_PRINCIPAL } from "@/lib/nav";
import { temPermissao, type Role } from "@/lib/auth/rbac";

const ICONES = {
  dashboard: LayoutDashboard,
  chat: MessagesSquare,
  calendar: CalendarDays,
  users: Users,
  package: Package,
  door: DoorOpen,
  bot: Bot,
  image: Images,
  chart: BarChart3,
  settings: Settings,
} as const;

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const itens = NAV_PRINCIPAL.filter((item) => !item.recurso || temPermissao(role, item.recurso, "ler"));
  return (
    <nav className="flex flex-col gap-1 px-3">
      {itens.map((item) => {
        const Icon = ICONES[item.icon as keyof typeof ICONES];
        const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              ativo
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
