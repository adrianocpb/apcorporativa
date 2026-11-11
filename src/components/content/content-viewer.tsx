import type { ReactNode } from "react";
import { IconCircleCheck, IconDownload, IconExternalLink } from "@tabler/icons-react";
import { buttonClasses } from "@/components/ui/button";
import { formatBytes } from "@/lib/file-rules";
import { QUIZ_KIND_LABEL, readQuiz } from "@/lib/quiz";
import { cn } from "@/lib/cn";

export type ViewerVersion = {
  title: string;
  description: string | null;
  bodyHtml: string | null;
  url: string | null;
  file: { id: string; originalName: string; mimeType: string; size: number } | null;
  quiz?: unknown;
};

/**
 * Exibição de um conteúdo conforme o tipo. Usado na pré-visualização do administrador
 * e, nas próximas fases, pelo colaborador (trilhas e Central de Conhecimento).
 */
export function ContentViewer({
  type,
  version,
  videoElement,
  quizElement,
  showQuizKey = false,
}: {
  type: string;
  version: ViewerVersion;
  /** Substitui o player padrão (ex.: player com registro de progresso nas trilhas). */
  videoElement?: ReactNode;
  /** Quiz para responder (trilhas). Sem ele, o quiz só aparece com gabarito se showQuizKey. */
  quizElement?: ReactNode;
  /** Pré-visualização do administrador: mostra perguntas com o gabarito. Nunca para colaboradores. */
  showQuizKey?: boolean;
}) {
  const fileUrl = version.file ? `/api/arquivos/${version.file.id}` : null;
  return (
    <article className="flex flex-col gap-5">
      {type === "FAQ" ? (
        <h2 className="text-h4 font-medium text-ink">{version.title}</h2>
      ) : (
        <header>
          <h2 className="text-h4 font-medium text-ink">{version.title}</h2>
          {version.description && <p className="mt-1 text-body text-ink-soft">{version.description}</p>}
        </header>
      )}

      {type === "VIDEO" && videoElement}
      {type === "VIDEO" && fileUrl && !videoElement && (
        <video
          controls
          preload="metadata"
          src={fileUrl}
          className="aspect-video w-full rounded-md bg-black"
          aria-label={version.title}
        >
          Seu navegador não reproduz este vídeo.
        </video>
      )}

      {type === "PDF" && fileUrl && version.file && (
        <div className="flex flex-col gap-3">
          <iframe
            src={fileUrl}
            title={version.title}
            className="h-[75vh] w-full rounded-md border border-line bg-surface"
          />
          <div className="flex flex-wrap gap-2">
            <a href={fileUrl} target="_blank" rel="noopener" className={buttonClasses("tonal", "sm")}>
              <IconExternalLink aria-hidden="true" /> Abrir em nova aba
            </a>
            <a href={`${fileUrl}?download=1`} className={buttonClasses("tonal", "sm")}>
              <IconDownload aria-hidden="true" /> Baixar ({formatBytes(version.file.size)})
            </a>
          </div>
        </div>
      )}

      {type === "IMAGE" && fileUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por rota autenticada
        <img
          src={fileUrl}
          alt={version.description ?? version.title}
          className="max-h-[75vh] w-auto max-w-full rounded-md border border-line"
        />
      )}

      {(type === "ARTICLE" || type === "FAQ") && version.bodyHtml && (
        <div
          className="rich-content"
          // HTML produzido no servidor por renderRichText: lista fechada de elementos, texto escapado.
          dangerouslySetInnerHTML={{ __html: version.bodyHtml }}
        />
      )}

      {type === "QUIZ" && quizElement}
      {type === "QUIZ" && !quizElement && showQuizKey && <QuizKey quiz={version.quiz} />}

      {type === "LINK" && version.url && (
        <div className="flex flex-col items-start gap-3 rounded-md border border-line p-5">
          <p className="text-body text-ink-soft">
            Este conteúdo abre um recurso externo em{" "}
            <strong className="font-medium text-ink">{new URL(version.url).hostname}</strong>.
          </p>
          <a
            href={version.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("primary")}
          >
            <IconExternalLink aria-hidden="true" /> Abrir link externo
          </a>
        </div>
      )}
    </article>
  );
}

/** Perguntas com o gabarito marcado (só na pré-visualização do administrador). */
function QuizKey({ quiz: value }: { quiz: unknown }) {
  const quiz = readQuiz(value);
  if (!quiz.questions.length) return <p className="text-body text-ink-muted">Nenhuma pergunta ainda.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-ink-muted">
        Nota mínima {quiz.passPercent}% · {quiz.maxAttempts ? `até ${quiz.maxAttempts} tentativa(s)` : "tentativas sem limite"}
        {quiz.shuffle ? " · ordem embaralhada" : ""}. O gabarito abaixo só aparece para o colaborador depois da aprovação.
      </p>
      <ol className="flex flex-col gap-4">
        {quiz.questions.map((q, i) => (
          <li key={q.id} className="flex flex-col gap-2 rounded-lg border border-line p-4">
            <p className="text-small text-ink-muted">
              Pergunta {i + 1} · {QUIZ_KIND_LABEL[q.kind]}
            </p>
            <p className="font-medium text-ink">{q.text || "(sem enunciado)"}</p>
            <ul className="flex flex-col gap-1.5">
              {q.options.map((o) => (
                <li
                  key={o.id}
                  className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-body", o.correct ? "bg-success-subtle text-success-text" : "text-ink-soft")}
                >
                  {o.correct && <IconCircleCheck className="size-4 shrink-0" aria-hidden="true" />}
                  {o.text || "(vazia)"}
                  {o.correct && <span className="sr-only"> (correta)</span>}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-small text-ink-soft">Explicação: {q.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
