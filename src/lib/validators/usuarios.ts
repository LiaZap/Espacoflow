import { z } from "zod";
import { ROLES } from "@/lib/auth/rbac";

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  role: z.enum(ROLES),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export const senhaSchema = z.string().min(8, "A senha deve ter ao menos 8 caracteres");

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
