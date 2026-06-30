import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { usuarios } from "./schema/usuarios";
import { salas, salasHorarios } from "./schema/salas";
import { pacotes, politicaCancelamento } from "./schema/pacotes";
import { agenteConfig, agentePrecos, agenteBaseConhecimento, agenteMidia } from "./schema/agente";
import { lgpdConfig } from "./schema/lgpd";
import {
  OWNER_SEED,
  SALAS_SEED,
  HORARIO_FUNCIONAMENTO,
  PACOTES_SEED,
  PRECOS_SEED,
  BASE_CONHECIMENTO_SEED,
  POLITICA_CANCELAMENTO_SEED,
  MSG_BOAS_VINDAS_SEED,
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
      msg_boas_vindas: MSG_BOAS_VINDAS_SEED,
      modified_by: ownerId,
    });
    console.log("✓ config da Hígia criada");
  } else if (!cfg[0].msg_boas_vindas) {
    // Config já existe mas sem a mensagem de boas-vindas (instalação anterior à R04).
    await db
      .update(agenteConfig)
      .set({ msg_boas_vindas: MSG_BOAS_VINDAS_SEED, updated_at: new Date() })
      .where(eq(agenteConfig.id, cfg[0].id));
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

  // --- Mídia da Hígia (fotos das salas, servidas de /public/salas) ---
  const MIDIA_SEED = [
    { nome: "Sala Privativa 01", tags: "sala-01", descricao: "Sala privativa para atendimento individual.", arquivo: "/salas/sala-01.jpg" },
    { nome: "Sala Privativa 02", tags: "sala-02", descricao: "Sala privativa para reuniões e mentorias.", arquivo: "/salas/sala-02.jpg" },
    { nome: "Sala Privativa 03", tags: "sala-03", descricao: "Sala privativa equipada para consultas.", arquivo: "/salas/sala-03.jpg" },
    { nome: "Lounge / Convivência", tags: "lounge", descricao: "Espaço de convivência e espera.", arquivo: "/salas/lounge.jpg" },
    { nome: "Ambiente do Espaço", tags: "ambiente", descricao: "Visão geral do coworking.", arquivo: "/salas/ambiente.jpg" },
  ];
  for (const md of MIDIA_SEED) {
    const [ex] = await db.select().from(agenteMidia).where(eq(agenteMidia.nome, md.nome));
    if (!ex) {
      await db.insert(agenteMidia).values({
        nome: md.nome,
        descricao: md.descricao,
        tags: md.tags,
        arquivo_url: md.arquivo,
        tipo_arquivo: "image/jpeg",
        nome_arquivo: md.arquivo.split("/").pop() ?? null,
        modified_by: ownerId,
      });
    }
  }
  console.log("✓ mídia da Hígia (fotos das salas) garantida");

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
