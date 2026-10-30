import { cn } from "@/lib/cn";

// Badges de nível do artefato "Assets ilustrados - plataforma gestão de conhecimento".
// Há uma ilustração por nível (1 a 5); níveis extras criados pelo administrador usam a do 5.
export const BADGE_COUNT = 5;

export function badgeNumber(levelNumber: number | undefined | null) {
  return Math.min(BADGE_COUNT, Math.max(1, levelNumber ?? 1));
}

/** Altura do preenchimento do arco na versão compacta (o arco enche conforme o nível sobe). */
const FILL_TOP = [245, 190, 135, 80];

/** Ilustração completa do nível (personagem dentro do arco). Arquivos em public/niveis. */
export function LevelIllustration({
  number,
  name,
  className,
  locked = false,
}: {
  number: number;
  name: string;
  className?: string;
  locked?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático e leve, sem otimização.
    <img
      src={`/niveis/nivel-${badgeNumber(number)}.svg`}
      alt={`Badge do nível ${number}, ${name}`}
      width={260}
      height={300}
      className={cn("h-auto w-full select-none", locked && "opacity-35 grayscale", className)}
      draggable={false}
    />
  );
}

/** Versão compacta para perfil, menu e listas: arco preenchido + "Nível N · Nome". */
export function LevelChip({ number, name, className }: { number: number; name: string; className?: string }) {
  const n = badgeNumber(number);
  const top = n < BADGE_COUNT;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border py-1 pr-3.5 pl-2 text-small font-medium",
        top ? "border-line-input bg-surface text-ink" : "border-line-input bg-black text-paper",
        className,
      )}
    >
      <svg viewBox="0 0 260 300" className="h-[22px] w-[19px] shrink-0" aria-hidden="true">
        {top ? (
          <>
            <defs>
              <clipPath id={`arco-${n}`}>
                <path d="M8 133 A122 122 0 0 1 252 133 V292 H8 Z" />
              </clipPath>
            </defs>
            <path d="M8 133 A122 122 0 0 1 252 133 V292 H8 Z" fill="#FFFFFF" />
            <rect x="0" y={FILL_TOP[n - 1]} width="260" height="300" fill="#0E0E0E" clipPath={`url(#arco-${n})`} />
            <path d="M8 133 A122 122 0 0 1 252 133 V292 H8 Z" fill="none" stroke="#0E0E0E" strokeWidth="16" />
          </>
        ) : (
          <>
            <path d="M8 133 A122 122 0 0 1 252 133 V292 H8 Z" fill="#EFF0EB" />
            <circle cx="80" cy="210" r="34" fill="#FF4303" />
            <circle cx="180" cy="210" r="34" fill="#0F96FF" />
            <circle cx="130" cy="140" r="34" fill="#F5195C" />
          </>
        )}
      </svg>
      <span className="truncate">
        Nível {number} · {name}
      </span>
    </span>
  );
}
