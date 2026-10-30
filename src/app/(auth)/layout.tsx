import { Archivo, Instrument_Serif } from "next/font/google";
import { RcLogo } from "@/components/layout/rc-logo";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

// Fontes de título das ilustrações RC+ (só nas telas de acesso).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["600", "700"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

/**
 * Telas de acesso (entrar, convite, redefinir senha): formulário à esquerda e,
 * em telas largas, a escada dos níveis à direita — layout do artefato de assets RC+.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={cn("flex min-h-screen flex-wrap", archivo.variable, instrumentSerif.variable)}>
      <section className="flex min-w-0 flex-[1_1_420px] flex-col justify-between gap-12 bg-surface px-6 py-10 sm:px-12 lg:px-16">
        <div className="flex items-center gap-3 text-ink">
          <RcLogo />
          <span className="h-6 w-px bg-line" aria-hidden="true" />
          <span className="text-small font-medium tracking-[0.2px] text-ink-muted uppercase">{BRAND.name}</span>
        </div>

        <main className="w-full max-w-[400px]">{children}</main>

        <p className="font-[family-name:var(--font-archivo)] text-caption font-semibold tracking-[0.12em] text-ink-muted">
          RC+ · UM ECOSSISTEMA DE SOLUÇÕES
        </p>
      </section>

      {/* Painel ilustrado: sempre no papel RC+, nos dois temas, para a ilustração manter o contraste. */}
      <section
        aria-hidden="true"
        className="hidden min-w-0 flex-[999_1_560px] flex-col justify-between gap-10 overflow-hidden bg-paper px-16 pt-14 text-black lg:flex"
      >
        <div className="flex max-w-[620px] flex-col gap-4 font-[family-name:var(--font-archivo)]">
          <p className="text-[clamp(40px,4.4vw,64px)] leading-[0.95] font-bold tracking-[-0.025em]">
            Conhecimento que{" "}
            <span className="font-[family-name:var(--font-instrument)] font-normal tracking-normal italic">
              se soma
            </span>
            .
          </p>
          <p className="text-[20px] leading-[1.35] font-medium text-[#5c5c58]">
            Cada trilha concluída sobe você um degrau — do primeiro dia até ensinar quem acabou de chegar.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ilustração SVG estática */}
        <img src="/ilustracoes/escada-niveis.svg" alt="" width={900} height={522} className="block h-auto w-full" />
      </section>
    </div>
  );
}
