"use client";

import { IconFileUpload, IconFile, IconRefresh } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, ProgressBar } from "@/components/ui/feedback";
import { FILE_RULES, formatBytes, type FileKindKey } from "@/lib/file-rules";
import { readVideoDuration, uploadFile } from "./upload-client";

export type CurrentFile = { id: string; name: string; size: number } | null;

/**
 * Seleciona e envia o arquivo na hora (com progresso). O formulário recebe só o id
 * do arquivo já validado pelo servidor, em campo oculto.
 */
export function FileUploadField({
  kind,
  initial,
  initialDuration,
  error,
}: {
  kind: FileKindKey;
  initial: CurrentFile;
  initialDuration?: number | null;
  error?: string;
}) {
  const rules = FILE_RULES[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<CurrentFile>(initial);
  const [duration, setDuration] = useState<number | null>(initialDuration ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onSelect(selected: File | undefined) {
    if (!selected) return;
    setUploadError(null);
    if (selected.size > rules.maxBytes) {
      setUploadError(`Arquivo maior que o permitido (${formatBytes(rules.maxBytes)}).`);
      return;
    }
    setProgress(0);
    try {
      const seconds = kind === "VIDEO" ? await readVideoDuration(selected) : null;
      const uploaded = await uploadFile(selected, kind, setProgress);
      setFile({ id: uploaded.id, name: uploaded.name, size: uploaded.size });
      setDuration(seconds);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-small font-medium text-ink">
        Arquivo <span className="text-danger-text" aria-hidden="true">*</span>
      </span>
      <input type="hidden" name="fileId" value={file?.id ?? ""} />
      <input type="hidden" name="durationSeconds" value={duration ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept={rules.accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onSelect(e.target.files?.[0])}
      />
      {file ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line px-4 py-3">
          <IconFile className="size-6 text-primary-text" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-ink">{file.name}</p>
            <p className="text-small text-ink-muted">
              {formatBytes(file.size)}
              {duration ? ` · ${Math.floor(duration / 60)} min ${duration % 60} s` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="tonal"
            icon={<IconRefresh />}
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            Substituir arquivo
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-line-input px-6 py-8 text-center hover:border-primary hover:bg-primary-subtle disabled:opacity-45"
        >
          <IconFileUpload className="size-8 text-primary-text" aria-hidden="true" />
          <span className="text-body font-medium text-ink">Selecionar {rules.label}</span>
          <span className="text-small text-ink-muted">
            {rules.formats} · até {formatBytes(rules.maxBytes)}
          </span>
        </button>
      )}
      {uploading && <ProgressBar value={progress} label="Progresso do envio" />}
      {file && !uploading && (
        <p className="text-small text-ink-muted">
          Substituir o arquivo de um conteúdo publicado cria uma nova versão; a anterior continua no
          histórico.
        </p>
      )}
      {(uploadError || error) && <Alert tone="danger">{uploadError ?? error}</Alert>}
    </div>
  );
}
