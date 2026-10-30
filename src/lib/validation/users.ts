import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label}: no máximo ${max} caracteres.` })
    .transform((v) => (v === "" ? null : v));

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
  department: optionalText(80, "Área"),
  hireDate: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))), {
      error: "Data de entrada inválida.",
    })
    .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00.000Z`))),
  roleKey: z.enum(["ADMIN", "COLABORADOR"], { error: "Selecione o perfil." }),
  groupIds: z.array(z.string().min(1).max(40)).max(50).optional().default([]),
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
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "Informe seu e-mail." })
    .max(254),
  password: z.string().min(1, { error: "Informe sua senha." }).max(256),
});
