import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { ROLE_LABEL, type SessaoUsuario } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";

interface AppShellProps {
  session: SessaoUsuario;
  children: React.ReactNode;
}

export function AppShell({ session, children }: AppShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr] print:block">
      <aside className="hidden flex-col border-r bg-sidebar md:flex print:hidden">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            F
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-sidebar-foreground">Espaço Flow</p>
            <p className="text-xs text-muted-foreground">Coworking</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav />
        </div>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{session.nome}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[session.role]}</p>
          </div>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </form>
        </div>
      </aside>

      <main className="min-h-screen overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
