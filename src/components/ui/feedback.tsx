import type { ReactNode } from "react";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export type Tone = "primary" | "success" | "warning" | "danger" | "info" | "secondary";

const badgeTones: Record<Tone, string> = {
  primary: "bg-primary-subtle text-primary-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  danger: "bg-danger-subtle text-danger-text",
  info: "bg-info-subtle text-info-text",
  secondary: "bg-secondary-subtle text-secondary-text",
};

export function Badge({
  tone = "secondary",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-small font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const alertIcons = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  danger: IconAlertCircle,
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertIcons;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = alertIcons[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md px-4 py-3", badgeTones[tone], className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-body">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(!!title && "text-small")}>{children}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-8 text-small", md: "size-[38px] text-body", lg: "size-14 text-h5" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-medium text-primary-text",
        sizes[size],
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  tone = "success",
  showValue = true,
}: {
  value: number;
  label: string;
  tone?: "primary" | "success" | "warning" | "info";
  showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  // Trilho no tom suave e barra na cor cheia do mesmo tom (padrão: verde de sucesso).
  const [track, fill] = {
    primary: ["bg-primary-subtle", "bg-primary"],
    success: ["bg-success-subtle", "bg-success"],
    warning: ["bg-warning-subtle", "bg-warning"],
    info: ["bg-info-subtle", "bg-info"],
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn("h-2 flex-1 overflow-hidden rounded-full", track)}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${pct}%` }} />
      </div>
      {showValue && <span className="w-10 text-right text-small font-medium text-ink">{pct}%</span>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && (
        <span
          className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary-text [&_svg]:size-7"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <p className="text-h6 font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-body text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
