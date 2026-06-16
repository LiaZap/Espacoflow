import { z } from "zod";

const horaOpcional = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Hora inválida")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const configAgenteSchema = z.object({
  nome_espaco: z.string().trim().min(1, "Informe o nome do espaço"),
  nome_agente: z.string().trim().min(1, "Informe o nome do agente"),
  modelo_ia: z.string().trim().min(1).default("claude-opus-4-8"),
  hora_inicio: horaOpcional,
  hora_fim: horaOpcional,
  prompt_sistema: z.string().trim().optional(),
});

export type ConfigAgenteInput = z.infer<typeof configAgenteSchema>;
