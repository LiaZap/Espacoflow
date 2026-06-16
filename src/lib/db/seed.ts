import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { usuarios } from "./schema/usuarios";
import { salas, salasHorarios } from "./schema/salas";
import { pacotes, politicaCancelamento } from "./schema/pacotes";
import { agenteConfig, agentePrecos, agenteBaseConhecimento } from "./schema/agente";
import { lgpdConfig } from "./schema/lgpd";
import {
  OWNER_SEED,
  SALAS_SEED,
  HORARIO_FUNCIONAMENTO,
  PACOTES_SEED,
  PRECOS_SEED,
  BASE_CONHECIMENTO_SEED,
  POLITICA_CANCELAMENTO_SEED,
} from "./seed-data";

/** Seed idempotente: roda quantas vezes quiser sem duplicar dados. */
async function main() {
  // --- Owner ---
  const [ownerExistente] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, OWNER_SEED.email));

  let ownerId = ownerExistente?.id;
  if (!ownerExistente) {
    const hash = await bcrypt.hash(OWNER_SEED.senha, 12);
    const [novo] = await db
      .insert(usuarios)
      .values({
        nome: OWNER_SEED.nome,
        email: OWNER_SEED.email,
        senha_hash: hash,
        role: OWNER_SEED.role,
        telefone: OWNER_SEED.telefone,
      })
      .returning();
    ownerId = novo.id;
    console.log(`✓ owner criado: ${OWNER_SEED.email} (senha padrão: troque no 1º acesso)`);
  } else {
    console.log(`• owner já existe: ${OWNER_SEED.email}`);
  }

  // --- Salas + horários ---
  for (const s of SALAS_SEED) {
    const [ex] = await db.select().from(salas).where(eq(salas.nome, s.nome));
    if (ex) continue;
    const [nova] = await db.insert(salas).values({ ...s, modified_by: ownerId }).returning();
    for (let dia = 0; dia < 7; dia++) {
      await db.insert(salasHorarios).values({
        sala_id: nova.id,
        dia_semana: dia,
        abre_em: HORARIO_FUNCIONAMENTO.abre_em,
        fecha_em: HORARIO_FUNCIONAMENTO.fecha_em,
        modified_by: ownerId,
      });
    }
    console.log(`✓ sala criada: ${s.nome}`);
  }

  // --- Pacotes ---
  for (const p of PACOTES_SEED) {
    const [ex] = await db.select().from(pacotes).where(eq(pacotes.nome, p.nome));
    if (!ex) await db.insert(pacotes).values({ ...p, modified_by: ownerId });
  }
  console.log("✓ pacotes garantidos");

  // --- Política de cancelamento ---
  const pol = await db.select().from(politicaCancelamento);
  if (pol.length === 0) {
    await db.insert(politicaCancelamento).values({ ...POLITICA_CANCELAMENTO_SEED, modified_by: ownerId });
    console.log("✓ política de cancelamento criada");
  }

  // --- Config do agente Hígia ---
  const cfg = await db.select().from(agenteConfig);
  if (cfg.length === 0) {
    await db.insert(agenteConfig).values({
      hora_inicio: "07:00:00",
      hora_fim: "23:00:00",
      modified_by: ownerId,
    });
    console.log("✓ config da Hígia criada");
  }

  // --- Preços da Hígia ---
  for (const pr of PRECOS_SEED) {
    const [ex] = await db.select().from(agentePrecos).where(eq(agentePrecos.descricao, pr.descricao));
    if (!ex) await db.insert(agentePrecos).values({ ...pr, modified_by: ownerId });
  }
  console.log("✓ preços da Hígia garantidos");

  // --- Base de conhecimento ---
  for (const b of BASE_CONHECIMENTO_SEED) {
    const [ex] = await db
      .select()
      .from(agenteBaseConhecimento)
      .where(eq(agenteBaseConhecimento.titulo, b.titulo));
    if (!ex) await db.insert(agenteBaseConhecimento).values({ ...b, modified_by: ownerId });
  }
  console.log("✓ base de conhecimento garantida");

  // --- LGPD config ---
  const lg = await db.select().from(lgpdConfig);
  if (lg.length === 0) {
    await db.insert(lgpdConfig).values({ email_dpo: OWNER_SEED.email, modified_by: ownerId });
    console.log("✓ config LGPD criada");
  }

  console.log("\n✅ Seed concluído.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro no seed:", e);
  process.exit(1);
});
