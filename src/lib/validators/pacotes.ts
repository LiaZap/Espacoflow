import { z } from "zod";

export const pacoteSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  descricao: z.string().trim().optional(),
  horas_incluidas: z.coerce.number().positive("Horas devem ser positivas"),
  validade_dias: z.coerce.number().int().positive().default(60),
  preco: z.coerce.number().min(0),
  tipo: z.enum(["avulsa", "pacote", "diaria", "plano_mensal"]).default("pacote"),
  ativo: z.coerce.boolean().default(true),
});

export type PacoteInput = z.infer<typeof pacoteSchema>;

export const venderPacoteSchema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  pacote_id: z.string().uuid("Selecione o pacote"),
});

export type VenderPacoteInput = z.infer<typeof venderPacoteSchema>;
