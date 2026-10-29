"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/server/actions";

type Candidate = { id: string; name: string; email: string; department: string | null };

export function AddMembersForm({
  action,
  users,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  users: Candidate[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.department ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [users, query]);

  if (users.length === 0) {
    return <p className="text-body text-ink-soft">Todos os usuários disponíveis já estão no grupo.</p>;
  }

  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-3">
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrar por nome, e-mail ou área"
        aria-label="Filtrar usuários"
      />
      <fieldset className="max-h-72 overflow-y-auto rounded-md border border-line">
        <legend className="sr-only">Usuários para adicionar</legend>
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-small text-ink-muted">Nenhum usuário encontrado.</p>
        )}
        {users.map((u) => (
          <label
            key={u.id}
            className={
              filtered.includes(u)
                ? "flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-hover"
                : "hidden"
            }
          >
            <Checkbox name="userIds" value={u.id} />
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
        <Button type="submit" variant="tonal" loading={pending}>
          Adicionar selecionados
        </Button>
      </div>
    </form>
  );
}
