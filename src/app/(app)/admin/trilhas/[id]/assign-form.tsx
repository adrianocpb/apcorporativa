"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/server/actions";

type Person = { id: string; name: string; email: string; department: string | null };
type Group = { id: string; name: string; _count: { members: number } };

/** Seleção de pessoas e grupos para atribuir a trilha. */
export function AssignForm({
  action,
  users,
  groups,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  users: Person[];
  groups: Group[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  const q = query.trim().toLowerCase();
  const matchUser = useMemo(
    () => (u: Person) => !q || [u.name, u.email, u.department ?? ""].some((v) => v.toLowerCase().includes(q)),
    [q],
  );
  const matchGroup = (g: Group) => !q || g.name.toLowerCase().includes(q);

  if (users.length === 0 && groups.length === 0) {
    return <p className="text-body text-ink-soft">Todas as pessoas e grupos já têm esta trilha.</p>;
  }

  const rowClass =
    "flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-hover";

  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-3">
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrar por nome, e-mail, área ou grupo"
        aria-label="Filtrar pessoas e grupos"
      />
      <fieldset className="max-h-80 overflow-y-auto rounded-md border border-line">
        <legend className="sr-only">Pessoas e grupos</legend>
        {groups.length > 0 && (
          <p className="bg-surface-hover px-3 py-1.5 text-small font-medium tracking-[0.2px] text-ink uppercase">Grupos</p>
        )}
        {groups.map((g) => (
          <label key={g.id} className={cn(rowClass, !matchGroup(g) && "hidden")}>
            <Checkbox name="groupIds" value={g.id} aria-label={g.name} />
            <span className="min-w-0">
              <span className="block truncate text-body text-ink">{g.name}</span>
              <span className="block text-small text-ink-muted">{g._count.members} membro(s) · novos membros recebem a trilha</span>
            </span>
          </label>
        ))}
        {users.length > 0 && (
          <p className="bg-surface-hover px-3 py-1.5 text-small font-medium tracking-[0.2px] text-ink uppercase">Pessoas</p>
        )}
        {users.map((u) => (
          <label key={u.id} className={cn(rowClass, !matchUser(u) && "hidden")}>
            <Checkbox name="userIds" value={u.id} aria-label={u.name} />
            <span className="min-w-0">
              <span className="block truncate text-body text-ink">{u.name}</span>
              <span className="block truncate text-small text-ink-muted">
                {[u.email, u.department].filter(Boolean).join(" · ")}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit" loading={pending}>
          Atribuir selecionados
        </Button>
      </div>
    </form>
  );
}
