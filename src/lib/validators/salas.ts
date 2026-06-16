import { z } from "zod";

export const salaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da sala"),
  tipo: z.string().trim().default("privativa"),
  capacidade: z.coerce.number().int().min(1).max(20).default(1),
  descricao: z.string().trim().optional(),
  prioridade_alocacao: z.coerce.number().int().min(0).default(0),
  preco_hora: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
});

export type SalaInput = z.infer<typeof salaSchema>;
