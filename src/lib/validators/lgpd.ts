import { z } from "zod";

export const TIPOS_DSAR = [
  ["acesso", "Acesso aos dados"],
  ["retificacao", "Retificação"],
  ["portabilidade", "Portabilidade"],
  ["eliminacao", "Eliminação"],
  ["anonimizacao", "Anonimização"],
  ["revogacao", "Revogação de consentimento"],
  ["oposicao", "Oposição"],
] as const;

export const solicitacaoSchema = z.object({
  nome_solicitante: z.string().trim().min(2, "Informe o nome do solicitante"),
  email_solicitante: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  telefone_solicitante: z.string().trim().optional(),
  tipo: z.enum([
    "acesso",
    "retificacao",
    "portabilidade",
    "eliminacao",
    "anonimizacao",
    "revogacao",
    "oposicao",
  ]),
  prioridade: z.enum(["baixa", "normal", "alta"]).default("normal"),
  descricao: z.string().trim().optional(),
});

export type SolicitacaoInput = z.infer<typeof solicitacaoSchema>;
