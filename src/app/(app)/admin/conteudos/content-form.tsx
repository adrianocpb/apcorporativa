"use client";

import { IconEye, IconSend } from "@tabler/icons-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { FileUploadField, type CurrentFile } from "@/components/content/file-upload-field";
import { RichTextEditor } from "@/components/content/rich-text-editor";
import type { RichNode } from "@/lib/rich-text";
import type { ActionState } from "@/server/actions";

export type ContentFormValues = {
  title: string;
  description: string;
  categoryId: string;
  inLibrary: boolean;
  file: CurrentFile;
  durationSeconds: number | null;
  url: string;
  body: RichNode | null;
};

const FILE_KIND = { VIDEO: "VIDEO", PDF: "PDF", IMAGE: "IMAGE" } as const;

export function ContentForm({
  type,
  action,
  categories,
  initial,
  hasPublished,
}: {
  type: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; label: string }[];
  initial: ContentFormValues;
  /** Já existe versão publicada: ao publicar, pergunta se a mudança é relevante. */
  hasPublished: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [intent, setIntent] = useState<string>("save");
  const err = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  // Envio manual (sem a prop action do <form>): o React não limpa o formulário,
  // preservando editor e arquivo enviado quando há erro de validação.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    setIntent(String(formData.get("intent") ?? "save"));
    startTransition(() => dispatch(formData));
  }

  const isFaq = type === "FAQ";
  const fileKind = FILE_KIND[type as keyof typeof FILE_KIND];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}

      <Field label={isFaq ? "Pergunta" : "Título"} name="title" required error={err.title}>
        {(p) => <Input {...p} defaultValue={initial.title} maxLength={160} />}
      </Field>

      {!isFaq && (
        <Field
          label={type === "IMAGE" ? "Descrição da imagem" : "Descrição"}
          name="description"
          error={err.description}
          hint={
            type === "IMAGE"
              ? "Descreva o que a imagem mostra (usada por leitores de tela)."
              : "Resumo exibido nas listas e na busca."
          }
        >
          {(p) => <Textarea {...p} defaultValue={initial.description} rows={3} maxLength={1000} />}
        </Field>
      )}

      {fileKind && (
        <FileUploadField
          kind={fileKind}
          initial={initial.file}
          initialDuration={initial.durationSeconds}
          error={err.fileId}
        />
      )}

      {type === "LINK" && (
        <Field
          label="Endereço"
          name="url"
          required
          error={err.url}
          hint="Endereço completo, por exemplo https://portal.empresa.com.br"
        >
          {(p) => <Input {...p} type="url" defaultValue={initial.url} placeholder="https://" />}
        </Field>
      )}

      {(type === "ARTICLE" || isFaq) && (
        <RichTextEditor
          name="body"
          initial={initial.body}
          label={isFaq ? "Resposta" : "Texto"}
          error={err.body}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Categoria" name="categoryId" error={err.categoryId}>
          {(p) => (
            <Select {...p} defaultValue={initial.categoryId}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <label className="flex items-start gap-3 self-end rounded-md border border-line px-3 py-2.5">
          <Checkbox name="inLibrary" defaultChecked={initial.inLibrary} className="mt-0.5" />
          <span>
            <span className="block text-body text-ink">Exibir na Central de Conhecimento</span>
            <span className="block text-small text-ink-muted">
              Desmarque para usar apenas dentro de trilhas.
            </span>
          </span>
        </label>
      </div>

      {hasPublished && (
        <fieldset className="flex flex-col gap-4 rounded-md border border-line p-4">
          <legend className="px-1 text-small font-medium text-ink">Ao publicar esta alteração</legend>
          <Field label="Resumo da alteração" name="changeNote" error={err.changeNote} hint="Opcional. Fica no histórico de versões.">
            {(p) => <Input {...p} maxLength={300} placeholder="Ex.: atualização das telas do novo menu" />}
          </Field>
          <label className="flex items-start gap-3">
            <Checkbox name="requiresRecompletion" className="mt-0.5" />
            <span>
              <span className="block text-body text-ink">Mudança relevante: exigir nova conclusão</span>
              <span className="block text-small text-ink-muted">
                Quem já concluiu precisará rever nas trilhas em andamento. As conclusões anteriores
                continuam no histórico.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <Button type="submit" name="intent" value="publish" icon={<IconSend />} loading={pending && intent === "publish"} disabled={pending}>
          Publicar
        </Button>
        <Button type="submit" name="intent" value="save" variant="tonal" loading={pending && intent === "save"} disabled={pending}>
          Salvar rascunho
        </Button>
        <Button type="submit" name="intent" value="preview" variant="ghost" icon={<IconEye />} loading={pending && intent === "preview"} disabled={pending}>
          Salvar e pré-visualizar
        </Button>
      </div>
    </form>
  );
}
