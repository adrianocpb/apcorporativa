import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-md bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 px-6 pt-6", className)}>
      <div className="min-w-0">
        <h2 className="text-h5 font-medium text-ink">{title}</h2>
        {subtitle && <p className="text-small text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}

/** KPI: o número é o elemento mais forte do card. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "secondary";
}) {
  const toneClasses = {
    primary: "bg-primary-subtle text-primary-text",
    success: "bg-success-subtle text-success-text",
    warning: "bg-warning-subtle text-warning-text",
    danger: "bg-danger-subtle text-danger-text",
    info: "bg-info-subtle text-info-text",
    secondary: "bg-secondary-subtle text-secondary-text",
  }[tone];
  return (
    <Card className="flex items-start gap-4 p-6">
      {icon && (
        <span
          className={cn(
            "flex size-[38px] shrink-0 items-center justify-center rounded-md [&_svg]:size-[22px]",
            toneClasses,
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-small text-ink-soft">{label}</p>
        <p className="text-h4 font-medium text-ink">{value}</p>
        {hint && <p className="text-small text-ink-muted">{hint}</p>}
      </div>
    </Card>
  );
}
