import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label}: no máximo ${max} caracteres.` })
    .transform((v) => (v === "" ? null : v));

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export const userInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: "Informe o nome completo." })
    .max(120, { error: "Nome: no máximo 120 caracteres." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, { error: "E-mail muito longo." })
    .pipe(z.email({ error: "Informe um e-mail válido." })),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, {
      error: "Use de 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.",
    }),
  department: optionalText(80, "Área"),
  jobTitle: optionalText(80, "Cargo"),
  hireDate: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))), {
      error: "Data de entrada inválida.",
    })
    .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00.000Z`))),
  roleKey: z.enum(["ADMIN", "COLABORADOR"], { error: "Selecione o perfil." }),
});

export type UserInput = z.output<typeof userInputSchema>;

export const groupInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome do grupo." })
    .max(80, { error: "Nome: no máximo 80 caracteres." }),
  description: optionalText(300, "Descrição"),
});

export type GroupInput = z.output<typeof groupInputSchema>;

export const newPasswordSchema = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    error: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "Informe seu e-mail ou login." })
    .max(254),
  password: z.string().min(1, { error: "Informe sua senha." }).max(256),
});
