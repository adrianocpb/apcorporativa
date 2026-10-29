import type { Tone } from "@/components/ui/feedback";

export const USER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  INVITED: { label: "Convite pendente", tone: "warning" },
  INACTIVE: { label: "Inativo", tone: "secondary" },
};

export const ROLE_OPTIONS = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "ADMIN", label: "Administrador" },
];
