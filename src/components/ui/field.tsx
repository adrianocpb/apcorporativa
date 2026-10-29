import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-md border bg-surface text-body text-ink placeholder:text-ink-muted " +
  "transition-colors focus:border-primary focus:outline-none focus-visible:outline-none " +
  "focus:ring-2 focus:ring-primary/25 disabled:opacity-45";

function controlClasses(invalid?: boolean, className?: string) {
  return cn(
    controlBase,
    invalid ? "border-danger" : "border-line-input",
    className,
  );
}

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    required?: boolean;
  }) => ReactNode;
  className?: string;
};

/** Rótulo, dica e erro acessíveis em volta de qualquer controle. */
export function Field({ label, name, error, hint, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
        {required && (
          <span className="text-danger-text" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children({
        id,
        name,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
      })}
      {error ? (
        <p id={errorId} className="text-small text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={controlClasses(props["aria-invalid"] === true, cn("h-[38px] px-3", className))}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={controlClasses(props["aria-invalid"] === true, cn("h-[38px] px-3", className))}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={controlClasses(props["aria-invalid"] === true, cn("min-h-24 px-3 py-2", className))}
      {...props}
    />
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn("size-[18px] rounded-sm border-line-input accent-[var(--primary)]", className)}
      {...props}
    />
  );
}
