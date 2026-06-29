/** Itens de navegação do backoffice (sidebar). */
export interface ItemNav {
  href: string;
  label: string;
  icon: string; // chave em ICONES (sidebar-nav.tsx)
  recurso?: string; // recurso RBAC exigido (ação "ler"); ausente = visível a todos
}

export const NAV_PRINCIPAL: ItemNav[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/conversas", label: "Conversas", icon: "chat", recurso: "conversas" },
  { href: "/reservas", label: "Reservas", icon: "calendar", recurso: "reservas" },
  { href: "/clientes", label: "Clientes", icon: "users", recurso: "clientes" },
  { href: "/pacotes", label: "Pacotes & Saldo", icon: "package", recurso: "pacotes" },
  { href: "/salas", label: "Salas", icon: "door", recurso: "salas" },
  { href: "/agente", label: "Agente Hígia", icon: "bot", recurso: "agente" },
  { href: "/midia", label: "Fotos da Hígia", icon: "image", recurso: "agente" },
  { href: "/relatorios", label: "Relatórios", icon: "chart", recurso: "relatorios" },
  { href: "/painel-owner", label: "Painel Owner", icon: "shield", recurso: "painel_owner" },
  { href: "/configuracoes", label: "Configurações", icon: "settings", recurso: "configuracoes" },
];
