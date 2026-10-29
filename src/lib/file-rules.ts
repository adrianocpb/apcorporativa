// Regras de upload compartilhadas entre o navegador (atributo accept, mensagens) e o servidor.

export type FileKindKey = "VIDEO" | "PDF" | "IMAGE";

const MB = 1024 * 1024;

function limitMb(envValue: string | undefined, fallback: number) {
  const n = Number(envValue);
  return (Number.isFinite(n) && n > 0 ? n : fallback) * MB;
}

export const FILE_RULES: Record<
  FileKindKey,
  { label: string; mimes: Record<string, string>; maxBytes: number; accept: string; formats: string }
> = {
  VIDEO: {
    label: "vídeo",
    mimes: { "video/mp4": "mp4", "video/webm": "webm" },
    maxBytes: limitMb(process.env.NEXT_PUBLIC_MAX_VIDEO_MB, 2048),
    accept: "video/mp4,video/webm",
    formats: "MP4 ou WebM",
  },
  PDF: {
    label: "PDF",
    mimes: { "application/pdf": "pdf" },
    maxBytes: limitMb(process.env.NEXT_PUBLIC_MAX_PDF_MB, 50),
    accept: "application/pdf",
    formats: "PDF",
  },
  IMAGE: {
    label: "imagem",
    mimes: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" },
    maxBytes: limitMb(process.env.NEXT_PUBLIC_MAX_IMAGE_MB, 10),
    accept: "image/png,image/jpeg,image/webp,image/gif",
    formats: "PNG, JPG, WebP ou GIF",
  },
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2).replace(".", ",")} GB`;
}
