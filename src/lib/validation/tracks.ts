import { z } from "zod";

const blankIfMissing = (v: unknown) => (v === undefined || v === null ? "" : v);

const optionalText = (max: number, label: string) =>
  z
    .preprocess(
      blankIfMissing,
      z.string().trim().max(max, { error: `${label}: no máximo ${max} caracteres.` }),
    )
    .transform((v) => (v === "" ? null : v));

const checkbox = z
  .unknown()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

const intBetween = (min: number, max: number, fallback: number, message: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? fallback : Number(v)),
    z.number({ error: message }).int({ error: message }).min(min, { error: message }).max(max, { error: message }),
  );

export const trackInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { error: "Informe um nome com pelo menos 3 caracteres." })
    .max(160, { error: "Nome: no máximo 160 caracteres." }),
  description: optionalText(2000, "Descrição"),
  categoryId: optionalText(40, "Categoria"),
  coverFileId: optionalText(40, "Capa"),
  sequential: checkbox,
  isOnboarding: checkbox,
  videoThresholdPct: intBetween(50, 100, 90, "Use um percentual entre 50 e 100."),
  minReadSeconds: intBetween(0, 600, 30, "Use um tempo entre 0 e 600 segundos."),
});

export type TrackInput = z.output<typeof trackInputSchema>;

export const moduleInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome da etapa." })
    .max(120, { error: "Nome: no máximo 120 caracteres." }),
  description: optionalText(500, "Descrição"),
});

export const structureSchema = z
  .array(z.object({ moduleId: z.string().min(1), itemIds: z.array(z.string().min(1)) }))
  .max(100);
