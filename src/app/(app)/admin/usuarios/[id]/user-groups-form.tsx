"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/server/actions";

export function UserGroupsForm({
  action,
  groups,
  selected,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  groups: { id: string; name: string }[];
  selected: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  if (groups.length === 0) {
    return (
      <p className="text-body text-ink-soft">
        Nenhum grupo criado ainda.{" "}
        <Link href="/admin/grupos" className="text-primary-text hover:underline">
          Criar grupos
        </Link>
      </p>
    );
  }

  return (
    <form key={selected.join(",")} action={formAction} className="flex flex-col gap-4">
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <fieldset>
        <legend className="sr-only">Grupos do usuário</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 hover:bg-surface-hover"
            >
              <Checkbox name="groupIds" value={g.id} defaultChecked={selected.includes(g.id)} />
              <span className="text-body text-ink">{g.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Button type="submit" variant="tonal" loading={pending}>
          Salvar grupos
        </Button>
      </div>
    </form>
  );
}
