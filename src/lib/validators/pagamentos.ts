import { z } from "zod";

export const registrarPagamentoSchema = z.object({
  cliente_id: z.string().uuid(),
  reserva_id: z.string().uuid().optional(),
  cliente_pacote_id: z.string().uuid().optional(),
  valor: z.coerce.number().min(0).optional(),
  comprovante_url: z.string().trim().url("URL inválida").optional().or(z.literal("")),
});

export type RegistrarPagamentoInput = z.infer<typeof registrarPagamentoSchema>;

export const validarPagamentoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["confirmado", "recusado"]),
  observacao: z.string().trim().optional(),
});

export type ValidarPagamentoInput = z.infer<typeof validarPagamentoSchema>;
