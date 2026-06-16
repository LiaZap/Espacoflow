import { z } from "zod";

export const reservaSchema = z.object({
  sala_id: z.string().uuid("Selecione a sala"),
  cliente_id: z.string().uuid("Selecione o cliente"),
  titulo: z.string().trim().default("Uso de sala"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  duracao_min: z.coerce
    .number()
    .int()
    .min(60, "Mínimo de 1 hora")
    .refine((v) => v % 30 === 0, "Use intervalos de 30 minutos"),
  tipo: z
    .enum(["tour", "uso_sala", "reuniao_comercial", "assinatura_contrato"])
    .default("uso_sala"),
  pacote_cliente_id: z.string().uuid().optional(),
  modalidade: z.string().trim().default("presencial"),
  notas_internas: z.string().trim().optional(),
});

export type ReservaInput = z.infer<typeof reservaSchema>;

export const cancelarReservaSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().optional(),
});
