"use client";

import type { FileKindKey } from "@/lib/file-rules";

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  kind: FileKindKey;
};

/** Envia o arquivo em fluxo para /api/arquivos, informando o progresso (0–100). */
export function uploadFile(
  file: File,
  kind: FileKindKey,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/arquivos?tipo=${kind}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { error?: string } & Partial<UploadedFile> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // resposta não-JSON
      }
      if (xhr.status === 201 && body.id) resolve(body as UploadedFile);
      else reject(new Error(body.error ?? "Não foi possível enviar o arquivo."));
    };
    xhr.onerror = () => reject(new Error("Falha de conexão durante o envio. Tente novamente."));
    xhr.send(file);
  });
}

/** Lê a duração de um vídeo no navegador (apenas informativa). */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}
