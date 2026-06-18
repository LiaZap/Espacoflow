/** Itens de navegação do backoffice (sidebar). */
export interface ItemNav {
  href: string;
  label: string;
  icon: string; // chave em ICONES (sidebar-nav.tsx)
}

export const NAV_PRINCIPAL: ItemNav[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/conversas", label: "Conversas", icon: "chat" },
  { href: "/reservas", label: "Reservas", icon: "calendar" },
  { href: "/clientes", label: "Clientes", icon: "users" },
  { href: "/pacotes", label: "Pacotes & Saldo", icon: "package" },
  { href: "/salas", label: "Salas", icon: "door" },
  { href: "/agente", label: "Agente Hígia", icon: "bot" },
  { href: "/midia", label: "Fotos da Hígia", icon: "image" },
  { href: "/relatorios", label: "Relatórios", icon: "chart" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
];
