import {
  IconFileText,
  IconHelpCircle,
  IconLink,
  IconMovie,
  IconNotebook,
  IconPhoto,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";

const ICONS = {
  VIDEO: IconMovie,
  PDF: IconFileText,
  IMAGE: IconPhoto,
  ARTICLE: IconNotebook,
  FAQ: IconHelpCircle,
  LINK: IconLink,
} as const;

/** Ícone do tipo de conteúdo em caixa tonal. */
export function ContentTypeIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" | "lg" }) {
  const Icon = ICONS[type as keyof typeof ICONS] ?? IconFileText;
  const sizes = {
    sm: "size-8 [&_svg]:size-[18px]",
    md: "size-[38px] [&_svg]:size-[22px]",
    lg: "size-12 [&_svg]:size-7",
  };
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-text",
        sizes[size],
      )}
      aria-hidden="true"
    >
      <Icon stroke={1.5} />
    </span>
  );
}
