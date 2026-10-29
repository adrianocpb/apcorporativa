import { IconDownload, IconFilter } from "@tabler/icons-react";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

type Options = { tracks: { id: string; title: string }[]; departments: string[]; users: { id: string; name: string }[] };

/** Filtros por trilha, área, pessoa e período (GET, compartilháveis pela URL) + exportação. */
export function ReportFilters({
  basePath,
  tab,
  raw,
  options,
  showPerson,
  exportHref,
}: {
  basePath: string;
  tab: string;
  raw: Record<string, string>;
  options: Options;
  showPerson: boolean;
  exportHref?: string;
}) {
  const active = Object.values(raw).some(Boolean);
  return (
    <form
      method="get"
      action={basePath}
      aria-label="Filtros do relatório"
      className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_150px_150px_auto]"
    >
      <input type="hidden" name="aba" value={tab} />
      <Select name="trilha" defaultValue={raw.trilha} aria-label="Trilha">
        <option value="">Todas as trilhas</option>
        {options.tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </Select>
      <Select name="area" defaultValue={raw.area} aria-label="Área">
        <option value="">Todas as áreas</option>
        {options.departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      {showPerson ? (
        <Select name="pessoa" defaultValue={raw.pessoa} aria-label="Pessoa">
          <option value="">Todas as pessoas</option>
          {options.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      ) : (
        <span className="hidden xl:block" />
      )}
      <Input type="date" name="de" defaultValue={raw.de} aria-label="Período: de" title="De" />
      <Input type="date" name="ate" defaultValue={raw.ate} aria-label="Período: até" title="Até" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="tonal" icon={<IconFilter />}>
          Filtrar
        </Button>
        {active && (
          <ButtonLink href={`${basePath}?aba=${tab}`} variant="ghost">
            Limpar
          </ButtonLink>
        )}
        {exportHref && (
          <a href={exportHref} className={buttonClasses("outline")} download>
            <IconDownload aria-hidden="true" /> CSV
          </a>
        )}
      </div>
    </form>
  );
}

export function queryString(raw: Record<string, string>, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...raw, ...extra })) if (v) q.set(k, v);
  return q.toString();
}
