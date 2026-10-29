import { BrandMark } from "@/components/layout/brand-mark";
import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandMark />
          <p className="text-small text-ink-muted">{BRAND.tagline}</p>
        </div>
        <div className="rounded-md bg-surface p-6 shadow-card sm:p-8">{children}</div>
      </div>
    </main>
  );
}
