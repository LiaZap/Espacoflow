import { MongoClient, type Collection, type Db, type Document } from "mongodb";

let cliente: MongoClient | null = null;
let dbRef: Db | null = null;

export function mongoConfigurado(): boolean {
  return Boolean(process.env.MONGO_URL);
}

async function getDb(): Promise<Db | null> {
  if (!mongoConfigurado()) return null;
  if (!dbRef) {
    cliente = new MongoClient(process.env.MONGO_URL as string);
    await cliente.connect();
    dbRef = cliente.db(); // usa o database do path da URL
  }
  return dbRef;
}

export async function colecao<T extends Document = Document>(
  nome: string
): Promise<Collection<T> | null> {
  const db = await getDb();
  return db ? db.collection<T>(nome) : null;
}

/** Arquivo do payload bruto do WhatsApp (NoSQL flexível, fora do Postgres). */
export async function salvarPayloadBruto(doc: Record<string, unknown>): Promise<void> {
  const col = await colecao("whatsapp_payloads").catch(() => null);
  if (!col) return;
  await col.insertOne({ ...doc, _criadoEm: new Date() }).catch(() => undefined);
}

/** Log de cada chamada do modelo (prompt/resposta/tokens/latência). */
export async function registrarIaLog(doc: Record<string, unknown>): Promise<void> {
  const col = await colecao("ia_logs").catch(() => null);
  if (!col) return;
  await col.insertOne({ ...doc, _criadoEm: new Date() }).catch(() => undefined);
}

/** Memória do agente por cliente (upsert). */
export async function lembrarMemoria(
  clienteId: string,
  dados: Record<string, unknown>
): Promise<void> {
  const col = await colecao("agente_memoria").catch(() => null);
  if (!col) return;
  await col
    .updateOne({ clienteId }, { $set: { ...dados, _atualizadoEm: new Date() } }, { upsert: true })
    .catch(() => undefined);
}

export async function obterMemoria(clienteId: string): Promise<Record<string, unknown> | null> {
  const col = await colecao("agente_memoria").catch(() => null);
  if (!col) return null;
  return (await col.findOne({ clienteId }).catch(() => null)) as Record<string, unknown> | null;
}

/** Estado da conexão WhatsApp (QR atual + estado), por instância. */
export async function salvarEstadoWhatsapp(
  instancia: string,
  dados: Record<string, unknown>
): Promise<void> {
  const col = await colecao("whatsapp_estado").catch(() => null);
  if (!col) return;
  await col
    .updateOne({ instancia }, { $set: { ...dados, instancia, _atualizadoEm: new Date() } }, { upsert: true })
    .catch(() => undefined);
}

export async function obterEstadoWhatsapp(
  instancia: string
): Promise<Record<string, unknown> | null> {
  const col = await colecao("whatsapp_estado").catch(() => null);
  if (!col) return null;
  return (await col.findOne({ instancia }).catch(() => null)) as Record<string, unknown> | null;
}
