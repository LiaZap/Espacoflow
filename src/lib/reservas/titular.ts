import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";

/** Tipo da transação Drizzle (mesmo `tx` do db.transaction). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * De QUEM é o saldo (pacote de horas e crédito em R$) deste cliente.
 * Empresa com mais de um contato autorizado: os contatos apontam para o cliente TITULAR
 * (clientes.titular_id) e TODOS consomem o MESMO saldo — o do titular. Cliente comum
 * (titular_id null) é dono do próprio saldo. FONTE ÚNICA dessa resolução.
 */
export async function idDoSaldo(clienteId: string, tx?: Tx): Promise<string> {
  const exec = tx ?? db;
  const [cli] = await exec
    .select({ titular: clientes.titular_id })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  const titular = cli?.titular;
  // Sem vínculo, autorreferência (A→A) ou cadeia: NÃO seguimos além de um nível — um ciclo
  // (A→B→A) mal configurado no painel travaria o saldo em loop. Um nível cobre o caso real
  // (contatos de uma empresa) e é imune a ciclo por construção.
  if (!titular || titular === clienteId) return clienteId;
  // O titular precisa existir e estar ativo; senão o saldo volta a ser do próprio cliente
  // (nunca aponta para um registro excluído, o que sumiria com o saldo).
  const [t] = await exec
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.id, titular), eq(clientes.is_deleted, false)));
  return t?.id ?? clienteId;
}
