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
  modelo_ia: z.string().trim().min(1).default("claude-haiku-4-5"),
  hora_inicio: horaOpcional,
  hora_fim: horaOpcional,
  prompt_sistema: z.string().trim().optional(),
  msg_boas_vindas_novo: z.string().trim().optional(),
  msg_fora_perfil: z.string().trim().optional(),
  msg_boas_vindas: z.string().trim().optional(),
  pix_chave: z.string().trim().optional(),
  pix_beneficiario: z.string().trim().optional(),
  pix_copia_cola: z.string().trim().optional(),
  pix_instrucoes: z.string().trim().optional(),
});

export type ConfigAgenteInput = z.infer<typeof configAgenteSchema>;
