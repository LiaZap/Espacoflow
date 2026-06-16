import { z } from "zod";

/** Telefone BR: aceita com/sem +55, DDD e 8-9 dígitos. Normaliza para só dígitos. */
export const telefoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => /^\d{10,13}$/.test(v), "Telefone inválido (use DDD + número)");

export const emailOpcionalSchema = z
  .string()
  .trim()
  .email("E-mail inválido")
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Para optimistic locking: o updated_at que o cliente leu ao abrir o registro. */
export const updatedAtSchema = z.coerce.date();
