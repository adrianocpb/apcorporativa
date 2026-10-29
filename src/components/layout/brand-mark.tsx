import { BRAND } from "@/lib/brand";

export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className="flex size-8 items-center justify-center rounded-md bg-primary text-small font-semibold text-on-primary"
        aria-hidden="true"
      >
        {BRAND.shortName}
      </span>
      {showName && (
        <span className="text-h6 leading-tight font-semibold text-ink">{BRAND.name}</span>
      )}
    </span>
  );
}
