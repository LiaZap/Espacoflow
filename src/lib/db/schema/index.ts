/**
 * Barrel do schema Drizzle. Cada entidade vive em seu próprio arquivo
 * (alta coesão, < 500 linhas). Toda tabela tem as 5 colunas de auditoria
 * (created_at, updated_at, deleted_at, is_deleted, modified_by).
 *
 * Nomenclatura hierárquica: clientes -> clientes_pacotes -> clientes_pacotes_movimentos.
 * JSON (jsonb) é permitido APENAS em whatsapp_mensagens.payload_bruto.
 */
export * from "./usuarios";
export * from "./convites";
export * from "./auditoria";
export * from "./salas";
export * from "./clientes";
export * from "./whatsapp";
export * from "./pacotes";
export * from "./reservas";
export * from "./pagamentos";
export * from "./agente";
export * from "./jobs";
export * from "./lgpd";
export * from "./documentos";
