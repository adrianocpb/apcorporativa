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

export const CONTENT_TYPE: Record<string, { label: string; description: string }> = {
  VIDEO: { label: "Vídeo", description: "Treinamentos e tutoriais em MP4 ou WebM." },
  PDF: { label: "PDF", description: "Manuais, políticas e documentos para consulta." },
  IMAGE: { label: "Imagem", description: "Capturas de tela, fluxogramas e infográficos." },
  ARTICLE: { label: "Artigo / manual", description: "Texto escrito aqui, com títulos, imagens e tabelas." },
  FAQ: { label: "Pergunta frequente", description: "Uma pergunta e sua resposta." },
  LINK: { label: "Link externo", description: "Atalho para um sistema ou recurso fora da plataforma." },
};

export const CONTENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "warning" },
  PUBLISHED: { label: "Publicado", tone: "success" },
  ARCHIVED: { label: "Arquivado", tone: "secondary" },
};

export const VERSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "warning" },
  PUBLISHED: { label: "Vigente", tone: "success" },
  SUPERSEDED: { label: "Substituída", tone: "secondary" },
};

export const TRACK_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "warning" },
  PUBLISHED: { label: "Publicada", tone: "success" },
  ARCHIVED: { label: "Arquivada", tone: "secondary" },
};

export const COMPLETION_RULE: Record<string, string> = {
  WATCH: "Assistir ao vídeo",
  CONFIRM: "Confirmar leitura",
  VIEW: "Abrir conclui",
};

export const ITEM_STATE: Record<string, { label: string; tone: Tone }> = {
  LOCKED: { label: "Bloqueado", tone: "secondary" },
  AVAILABLE: { label: "Disponível", tone: "info" },
  IN_PROGRESS: { label: "Em andamento", tone: "warning" },
  COMPLETED: { label: "Concluído", tone: "success" },
};
