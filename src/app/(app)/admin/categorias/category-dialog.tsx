"use client";

import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/server/actions";

type Values = { name: string; description: string; parentId: string };

/** Botão + modal para criar ou editar uma categoria. */
export function CategoryDialog({
  action,
  parents,
  initial,
  mode,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  parents: { id: string; name: string }[];
  initial?: Values;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useFormAction(action);
  // Fica aberto desde o clique até um resultado de sucesso posterior à abertura.
  const [openedWith, setOpenedWith] = useState<number | undefined | null>(null);
  const open = openedWith !== null && !(state.ok && state.at !== openedWith);
  const v = (state.ok === false ? state.values : undefined) ?? initial;

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  return (
    <>
      {mode === "create" ? (
        <Button icon={<IconPlus />} onClick={() => setOpenedWith(state.at)}>
          Nova categoria
        </Button>
      ) : (
        <Button size="sm" variant="ghost" icon={<IconPencil />} onClick={() => setOpenedWith(state.at)}>
          Editar
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={(o) => setOpenedWith(o ? state.at : null)}
        title={mode === "create" ? "Nova categoria" : "Editar categoria"}
      >
        <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
          {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
          <Field label="Nome" name="name" required error={state.fieldErrors?.name}>
            {(p) => <Input {...p} defaultValue={v?.name} maxLength={80} autoFocus />}
          </Field>
          <Field
            label="Dentro de"
            name="parentId"
            error={state.fieldErrors?.parentId}
            hint="Deixe em branco para uma categoria principal."
          >
            {(p) => (
              <Select {...p} defaultValue={v?.parentId ?? ""}>
                <option value="">— Categoria principal —</option>
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Descrição" name="description" error={state.fieldErrors?.description}>
            {(p) => <Textarea {...p} defaultValue={v?.description} rows={2} maxLength={300} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="tonal" onClick={() => setOpenedWith(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {mode === "create" ? "Criar categoria" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
