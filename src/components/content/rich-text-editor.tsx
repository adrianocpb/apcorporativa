"use client";

import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconBold,
  IconColumnInsertRight,
  IconColumnRemove,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconLinkOff,
  IconList,
  IconListNumbers,
  IconPhoto,
  IconRowInsertBottom,
  IconRowRemove,
  IconSeparatorHorizontal,
  IconTable,
  IconTableOff,
  IconUnderline,
} from "@tabler/icons-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { EMPTY_DOC, renderRichText, safeHref, type RichNode } from "@/lib/rich-text";
import { uploadFile } from "./upload-client";

function ToolButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // mantém a seleção no editor
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover disabled:opacity-35 [&_svg]:size-[18px]",
        active && "bg-primary-subtle text-primary-text",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />;
}

function Toolbar({
  editor,
  onLink,
  onImage,
  uploading,
}: {
  editor: Editor;
  onLink: () => void;
  onImage: () => void;
  uploading: boolean;
}) {
  const inTable = editor.isActive("table");
  const chain = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5"
    >
      <ToolButton label="Título" active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <IconH2 />
      </ToolButton>
      <ToolButton label="Subtítulo" active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <IconH3 />
      </ToolButton>
      <Separator />
      <ToolButton label="Negrito" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
        <IconBold />
      </ToolButton>
      <ToolButton label="Itálico" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <IconItalic />
      </ToolButton>
      <ToolButton label="Sublinhado" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
        <IconUnderline />
      </ToolButton>
      <ToolButton label={editor.isActive("link") ? "Editar link" : "Inserir link"} active={editor.isActive("link")} onClick={onLink}>
        <IconLink />
      </ToolButton>
      {editor.isActive("link") && (
        <ToolButton label="Remover link" onClick={() => chain().unsetLink().run()}>
          <IconLinkOff />
        </ToolButton>
      )}
      <Separator />
      <ToolButton label="Lista" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>
        <IconList />
      </ToolButton>
      <ToolButton label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
        <IconListNumbers />
      </ToolButton>
      <ToolButton label="Destaque / instrução" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
        <IconBlockquote />
      </ToolButton>
      <ToolButton label="Linha divisória" onClick={() => chain().setHorizontalRule().run()}>
        <IconSeparatorHorizontal />
      </ToolButton>
      <Separator />
      <ToolButton label="Inserir imagem" onClick={onImage} disabled={uploading}>
        <IconPhoto />
      </ToolButton>
      <ToolButton
        label="Inserir tabela"
        disabled={inTable}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <IconTable />
      </ToolButton>
      {inTable && (
        <>
          <ToolButton label="Adicionar linha" onClick={() => chain().addRowAfter().run()}>
            <IconRowInsertBottom />
          </ToolButton>
          <ToolButton label="Adicionar coluna" onClick={() => chain().addColumnAfter().run()}>
            <IconColumnInsertRight />
          </ToolButton>
          <ToolButton label="Excluir linha" onClick={() => chain().deleteRow().run()}>
            <IconRowRemove />
          </ToolButton>
          <ToolButton label="Excluir coluna" onClick={() => chain().deleteColumn().run()}>
            <IconColumnRemove />
          </ToolButton>
          <ToolButton label="Excluir tabela" onClick={() => chain().deleteTable().run()}>
            <IconTableOff />
          </ToolButton>
        </>
      )}
      <Separator />
      <ToolButton label="Desfazer" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
        <IconArrowBackUp />
      </ToolButton>
      <ToolButton label="Refazer" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
        <IconArrowForwardUp />
      </ToolButton>
    </div>
  );
}

/**
 * Editor de manuais e artigos. Guarda o documento (JSON) em um campo oculto; o servidor
 * gera o HTML final apenas com elementos permitidos.
 */
export function RichTextEditor({
  name,
  initial,
  label,
  error,
}: {
  name: string;
  initial: RichNode | null;
  label: string;
  error?: string;
}) {
  const [json, setJson] = useState<RichNode>(initial ?? EMPTY_DOC);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ id: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: (initial ?? EMPTY_DOC) as JSONContent,
    editorProps: {
      attributes: {
        class: "rich-content min-h-[320px] px-5 py-4 focus:outline-none",
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => setJson(editor.getJSON() as RichNode),
  });

  function openLink() {
    if (!editor) return;
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "https://");
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const href = safeHref(linkValue);
    if (!href) {
      setLinkError("Informe um endereço completo (https://…) ou um e-mail (mailto:…).");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }

  async function onImageSelected(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "IMAGE");
      setPendingImage({ id: uploaded.id });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  function insertImage(formData: FormData) {
    if (!editor || !pendingImage) return;
    editor
      .chain()
      .focus()
      .setImage({
        src: `/api/arquivos/${pendingImage.id}`,
        alt: String(formData.get("alt") ?? "").slice(0, 300),
        title: String(formData.get("caption") ?? "").slice(0, 300) || undefined,
      })
      .run();
    setPendingImage(null);
  }

  const preview = mode === "preview" ? renderRichText(json).html : "";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-3">
        <span className="text-small font-medium text-ink">{label}</span>
        <div className="flex rounded-md bg-secondary-subtle p-0.5" role="tablist" aria-label="Modo do editor">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-sm px-3 py-1 text-small font-medium",
                mode === m ? "bg-surface text-ink shadow-card" : "text-ink-soft",
              )}
            >
              {m === "edit" ? "Editar" : "Visualizar"}
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name={name} value={JSON.stringify(json)} />
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onImageSelected(e.target.files?.[0])}
      />
      <div className={cn("overflow-hidden rounded-md border bg-surface", error ? "border-danger" : "border-line-input")}>
        {mode === "edit" ? (
          editor ? (
            <>
              <Toolbar editor={editor} onLink={openLink} onImage={() => imageInput.current?.click()} uploading={uploading} />
              <EditorContent editor={editor} />
            </>
          ) : (
            <div className="min-h-[360px]" />
          )
        ) : (
          <div
            className="rich-content min-h-[360px] px-5 py-4"
            // HTML gerado pela lista fechada de elementos de renderRichText (texto escapado).
            dangerouslySetInnerHTML={{ __html: preview || "<p><em>Nada escrito ainda.</em></p>" }}
          />
        )}
      </div>
      {uploading && <p className="text-small text-ink-muted">Enviando imagem…</p>}
      {imageError && <Alert tone="danger">{imageError}</Alert>}
      {error && <p className="text-small text-danger-text">{error}</p>}

      <Modal open={linkOpen} onOpenChange={setLinkOpen} title="Inserir link" size="sm">
        <div className="flex flex-col gap-4">
          <Field label="Endereço" name="link-href" error={linkError ?? undefined}>
            {(p) => (
              <Input
                {...p}
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                autoFocus
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="tonal" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={applyLink}>Aplicar</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!pendingImage}
        onOpenChange={(open) => !open && setPendingImage(null)}
        title="Descrever imagem"
        description="A descrição ajuda quem usa leitor de tela; a legenda aparece abaixo da imagem."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            insertImage(new FormData(e.currentTarget));
          }}
        >
          <Field label="Descrição da imagem" name="alt" required hint="Ex.: Tela de login do ERP com o campo Usuário em destaque.">
            {(p) => <Input {...p} maxLength={300} autoFocus />}
          </Field>
          <Field label="Legenda (opcional)" name="caption">
            {(p) => <Input {...p} maxLength={300} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="tonal" onClick={() => setPendingImage(null)}>
              Cancelar
            </Button>
            <Button type="submit">Inserir imagem</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
