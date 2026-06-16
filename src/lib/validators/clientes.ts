import { z } from "zod";
import { telefoneSchema, emailOpcionalSchema } from "./comum";

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  nome_chamada: z.string().trim().optional(),
  telefone: telefoneSchema,
  email: emailOpcionalSchema,
  documento: z.string().trim().optional(),
  status_lead: z
    .enum(["novo", "qualificando", "apto", "fora_perfil", "cliente", "inativo"])
    .default("novo"),
  qualification_score: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(100).optional()
  ),
  interesses: z.string().trim().optional(),
  dores: z.string().trim().optional(),
  origem: z.string().trim().optional(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export const anotacaoSchema = z.object({
  cliente_id: z.string().uuid(),
  tipo: z.enum(["nota", "ligacao", "tarefa", "follow_up"]).default("nota"),
  titulo: z.string().trim().optional(),
  descricao: z.string().trim().min(1, "Descreva a anotação"),
  agendado_para: z.coerce.date().optional(),
});

export type AnotacaoInput = z.infer<typeof anotacaoSchema>;
