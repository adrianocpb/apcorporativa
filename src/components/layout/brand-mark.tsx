import { BRAND } from "@/lib/brand";
import { RcLogo } from "@/components/layout/rc-logo";

export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <span className="flex items-center gap-3 text-ink">
      <RcLogo className="h-6" />
      {showName && (
        <>
          <span className="h-6 w-px bg-line" aria-hidden="true" />
          <span className="text-small leading-tight font-medium text-ink">{BRAND.name}</span>
        </>
      )}
    </span>
  );
}
