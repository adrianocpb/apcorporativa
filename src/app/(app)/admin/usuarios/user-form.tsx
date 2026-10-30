"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { CopyField } from "@/components/ui/copy-field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import { ROLE_OPTIONS } from "@/lib/labels";
import type { ActionState } from "@/server/actions";

export type UserFormValues = {
  name: string;
  email: string;
  department: string;
  hireDate: string;
  roleKey: string;
};

type CreatedData = { userId: string; name: string; url: string; expiresAt: string };

/** Formulário de cadastro/edição. Na criação, exibe o link de convite gerado. */
export function UserForm<T>({
  action,
  defaultValues,
  mode,
  departments,
  roleLocked,
  groups = [],
}: {
  action: (state: ActionState<T>, formData: FormData) => Promise<ActionState<T>>;
  defaultValues?: UserFormValues;
  mode: "create" | "edit";
  departments: string[];
  roleLocked?: boolean;
  /** Na criação: grupos disponíveis (a pessoa já recebe as trilhas desses grupos). */
  groups?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useFormAction(action);
  // O modal do convite abre a cada cadastro bem-sucedido até ser fechado.
  const [dismissedAt, setDismissedAt] = useState<number>();
  const router = useRouter();
  const created = mode === "create" && state.ok ? (state.data as CreatedData | undefined) : undefined;
  // Após um envio com erro, reexibe o que foi digitado.
  const v = (state.ok === false ? state.values : undefined) ?? defaultValues;
  const err = state.fieldErrors ?? {};
  // Fora do <form> para sobreviver à remontagem após erro de validação.
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    if (!state.ok) return;
    if (mode === "edit" && state.message) toast(state.message);
  }, [state, mode]);


  return (
    <>
      <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-5" noValidate>
        {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nome completo" name="name" required error={err.name} className="md:col-span-2">
            {(p) => <Input {...p} defaultValue={v?.name} autoComplete="off" maxLength={120} />}
          </Field>
          <Field label="E-mail" name="email" required error={err.email}>
            {(p) => <Input {...p} type="email" defaultValue={v?.email} autoComplete="off" />}
          </Field>
          <Field label="Área ou departamento" name="department" error={err.department}>
            {(p) => (
              <>
                <Input {...p} defaultValue={v?.department} list="areas" maxLength={80} />
                <datalist id="areas">
                  {departments.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field
            label="Data de entrada"
            name="hireDate"
            error={err.hireDate}
            hint="Opcional. Usada no acompanhamento do onboarding."
          >
            {(p) => <Input {...p} type="date" defaultValue={v?.hireDate} />}
          </Field>
          <Field
            label="Perfil de acesso"
            name="roleKey"
            required
            error={err.roleKey}
            hint={roleLocked ? "Você não pode alterar o seu próprio perfil." : undefined}
          >
            {(p) =>
              roleLocked ? (
                <>
                  <Select {...p} name={undefined} defaultValue={v?.roleKey} disabled>
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <input type="hidden" name="roleKey" value={v?.roleKey} />
                </>
              ) : (
                <Select {...p} defaultValue={v?.roleKey ?? "COLABORADOR"}>
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>
          {mode === "create" && (
            <fieldset className="md:col-span-2">
              <legend className="mb-1.5 text-small font-medium text-ink">Grupos</legend>
              {groups.length === 0 ? (
                <p className="text-small text-ink-muted">Nenhum grupo criado. Crie grupos em Administração → Grupos.</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {groups.map((g) => (
                      <label
                        key={g.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 hover:bg-surface-hover"
                      >
                        <Checkbox
                          name="groupIds"
                          value={g.id}
                          checked={selectedGroups.includes(g.id)}
                          onChange={(e) =>
                            setSelectedGroups((cur) =>
                              e.target.checked ? [...cur, g.id] : cur.filter((x) => x !== g.id),
                            )
                          }
                        />
                        <span className="text-body text-ink">{g.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1.5 text-small text-ink-muted">
                    A pessoa recebe na hora as trilhas atribuídas aos grupos escolhidos.
                  </p>
                </>
              )}
            </fieldset>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {mode === "create" ? "Cadastrar e gerar convite" : "Salvar alterações"}
          </Button>
          {mode === "create" && (
            <ButtonLink href="/admin/usuarios" variant="tonal">
              Cancelar
            </ButtonLink>
          )}
        </div>
      </form>

      {created && (
        <Modal
          open={dismissedAt !== state.at}
          onOpenChange={(open) => {
            if (!open) setDismissedAt(state.at);
            if (!open) router.push(`/admin/usuarios/${created.userId}`);
          }}
          title="Usuário cadastrado"
        >
          <div className="flex flex-col gap-4">
            <p className="text-body text-ink-soft">
              Envie este link de convite para <strong className="font-medium text-ink">{created.name}</strong>{" "}
              pelo canal interno da empresa. Com ele, a pessoa define a própria senha e ativa a conta.
            </p>
            <CopyField value={created.url} label="Link de convite" />
            <p className="text-small text-ink-muted">
              Válido até {created.expiresAt}, para um único uso. Se expirar, gere outro na página do
              usuário.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => router.push(`/admin/usuarios/${created.userId}`)}>
                Ir para o usuário
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
