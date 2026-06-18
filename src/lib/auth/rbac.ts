/**
 * RBAC do Espaço Flow.
 * Hierarquia (menor nível = mais poder): super_admin > owner > admin > recepcao > visualizador.
 */
export const ROLES = [
  "super_admin",
  "owner",
  "admin",
  "recepcao",
  "visualizador",
] as const;

export type Role = (typeof ROLES)[number];
export type Acao = "criar" | "ler" | "atualizar" | "excluir";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Proprietário",
  admin: "Administrador",
  recepcao: "Recepção",
  visualizador: "Visualizador",
};

const NIVEL: Record<Role, number> = {
  super_admin: 0,
  owner: 1,
  admin: 2,
  recepcao: 3,
  visualizador: 4,
};

/** Verdadeiro se `role` tem PELO MENOS o poder de `minimo`. */
export function temPapel(role: Role, minimo: Role): boolean {
  return NIVEL[role] <= NIVEL[minimo];
}

/**
 * Matriz de permissões por recurso:ação. O que não está listado é negado.
 * Recepção opera o dia a dia (clientes, reservas, conversas, pagamentos);
 * admin/owner gerenciam configuração, usuários e exclusões; visualizador só lê.
 */
const PERMISSOES: Record<string, Role[]> = {
  // Clientes / leads
  "clientes:criar": ["super_admin", "owner", "admin", "recepcao"],
  "clientes:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "clientes:atualizar": ["super_admin", "owner", "admin", "recepcao"],
  "clientes:excluir": ["super_admin", "owner", "admin"],
  // Reservas / agenda
  "reservas:criar": ["super_admin", "owner", "admin", "recepcao"],
  "reservas:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "reservas:atualizar": ["super_admin", "owner", "admin", "recepcao"],
  // Check-in (presença/no-show) — quem fica no local: recepção. super_admin para suporte.
  "reservas:checkin": ["super_admin", "recepcao"],
  "reservas:excluir": ["super_admin", "owner", "admin"],
  // Salas / recursos
  "salas:criar": ["super_admin", "owner", "admin"],
  "salas:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "salas:atualizar": ["super_admin", "owner", "admin"],
  "salas:excluir": ["super_admin", "owner", "admin"],
  // Pacotes / saldo
  "pacotes:criar": ["super_admin", "owner", "admin", "recepcao"],
  "pacotes:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "pacotes:atualizar": ["super_admin", "owner", "admin", "recepcao"],
  "pacotes:excluir": ["super_admin", "owner", "admin"],
  // Pagamentos Pix (validação é humana)
  "pagamentos:criar": ["super_admin", "owner", "admin", "recepcao"],
  "pagamentos:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "pagamentos:validar": ["super_admin", "owner", "admin", "recepcao"],
  // Conversas WhatsApp
  "conversas:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "conversas:atualizar": ["super_admin", "owner", "admin", "recepcao"],
  // Agente Hígia / base de conhecimento
  "agente:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "agente:atualizar": ["super_admin", "owner", "admin"],
  // Preços
  "precos:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  "precos:atualizar": ["super_admin", "owner", "admin"],
  // Usuários internos
  "usuarios:criar": ["super_admin", "owner", "admin"],
  "usuarios:ler": ["super_admin", "owner", "admin"],
  "usuarios:atualizar": ["super_admin", "owner", "admin"],
  "usuarios:excluir": ["super_admin", "owner"],
  // Auditoria / painel owner
  "auditoria:ler": ["super_admin", "owner", "admin"],
  "painel_owner:ler": ["super_admin", "owner"],
  // Relatórios
  "relatorios:ler": ["super_admin", "owner", "admin", "recepcao", "visualizador"],
  // Configurações
  "configuracoes:ler": ["super_admin", "owner", "admin"],
  "configuracoes:atualizar": ["super_admin", "owner", "admin"],
};

/** Checa a matriz `recurso:acao`. Default: negado. */
export function temPermissao(role: Role, recurso: string, acao: string): boolean {
  return PERMISSOES[`${recurso}:${acao}`]?.includes(role) ?? false;
}
