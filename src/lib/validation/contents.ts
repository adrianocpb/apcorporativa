import { z } from "zod";

export const CONTENT_TYPES = ["VIDEO", "PDF", "IMAGE", "ARTICLE", "FAQ", "LINK"] as const;
export type ContentTypeKey = (typeof CONTENT_TYPES)[number];

// Campo ausente conta como vazio (formulários e chamadas diretas aos serviços).
const blankIfMissing = (v: unknown) => (v === undefined || v === null ? "" : v);

const optionalText = (max: number, label: string) =>
  z
    .preprocess(
      blankIfMissing,
      z.string().trim().max(max, { error: `${label}: no máximo ${max} caracteres.` }),
    )
    .transform((v) => (v === "" ? null : v));

const optionalId = z
  .preprocess(blankIfMissing, z.string().trim().max(40))
  .transform((v) => (v === "" ? null : v));

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome da categoria." })
    .max(80, { error: "Nome: no máximo 80 caracteres." }),
  description: optionalText(300, "Descrição"),
  parentId: optionalId,
});

/** Campos enviados pelo formulário de conteúdo. A completude é checada ao publicar. */
export const contentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { error: "Informe um título com pelo menos 3 caracteres." })
    .max(160, { error: "Título: no máximo 160 caracteres." }),
  description: optionalText(1000, "Descrição"),
  categoryId: optionalId,
  inLibrary: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  fileId: optionalId,
  durationSeconds: z
    .string()
    .optional()
    .transform((v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n < 86400 ? n : null;
    }),
  url: optionalText(2000, "Endereço"),
  body: z
    .string()
    .max(500_000, { error: "O texto ficou grande demais. Divida em mais de um conteúdo." })
    .optional()
    .default(""),
});

export type ContentInput = z.output<typeof contentInputSchema>;

export const publishOptionsSchema = z.object({
  changeNote: optionalText(300, "Resumo da alteração"),
  requiresRecompletion: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
