"use client";

import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import { ACHIEVEMENT_TYPES, POINT_EVENT_LABEL } from "@/lib/gamification";
import type { ActionState } from "@/server/actions";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function useToastOnSuccess(state: ActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);
}

/** Valores de pontos por evento. */
export function RulesForm({ action, rules }: { action: Action; rules: { event: string; points: number; active: boolean }[] }) {
  const [state, formAction, pending] = useFormAction(action);
  useToastOnSuccess(state);
  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="flex flex-col divide-y divide-line rounded-md border border-line">
        {rules.map((r) => (
          <div key={r.event} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <label className="flex min-w-[220px] flex-1 items-center gap-3">
              <Checkbox name={`active_${r.event}`} defaultChecked={r.active} />
              <span className="text-body text-ink">{POINT_EVENT_LABEL[r.event]}</span>
            </label>
            <div className="flex w-36 items-center gap-2">
              <Input
                type="number"
                min={0}
                max={10000}
                name={`points_${r.event}`}
                defaultValue={state.values?.[`points_${r.event}`] ?? r.points}
                aria-label={`Pontos: ${POINT_EVENT_LABEL[r.event]}`}
                aria-invalid={state.fieldErrors?.[`points_${r.event}`] ? true : undefined}
              />
              <span className="text-small text-ink-muted">pts</span>
            </div>
            {state.fieldErrors?.[`points_${r.event}`] && (
              <p className="w-full text-small text-danger-text">{state.fieldErrors[`points_${r.event}`]}</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-small text-ink-muted">
        Cada conteúdo, etapa e trilha pontua uma única vez por pessoa — rever ou reconcluir não gera novos pontos.
        Mudanças valem para as próximas conclusões; pontos já concedidos não são recalculados.
      </p>
      <div>
        <Button type="submit" loading={pending}>
          Salvar regras
        </Button>
      </div>
    </form>
  );
}

function DialogButton({
  label,
  icon,
  variant = "tonal",
  title,
  state,
  children,
}: {
  label: string;
  icon: ReactNode;
  variant?: "tonal" | "ghost" | "primary";
  title: string;
  state: ActionState;
  children: (close: () => void) => ReactNode;
}) {
  const [openedWith, setOpenedWith] = useState<number | undefined | null>(null);
  const open = openedWith !== null && !(state.ok && state.at !== openedWith);
  return (
    <>
      <Button size="sm" variant={variant} icon={icon} onClick={() => setOpenedWith(state.at)}>
        {label}
      </Button>
      <Modal open={open} onOpenChange={(o) => setOpenedWith(o ? state.at : null)} title={title}>
        {children(() => setOpenedWith(null))}
      </Modal>
    </>
  );
}

/** Criar ou editar um nível. */
export function LevelDialog({
  action,
  initial,
  locked,
}: {
  action: Action;
  initial?: { name: string; minPoints: number };
  locked?: boolean;
}) {
  const [state, formAction, pending] = useFormAction(action);
  useToastOnSuccess(state);
  const v = state.ok === false ? state.values : undefined;
  return (
    <DialogButton
      label={initial ? "Editar" : "Novo nível"}
      icon={initial ? <IconPencil /> : <IconPlus />}
      variant={initial ? "ghost" : "primary"}
      title={initial ? "Editar nível" : "Novo nível"}
      state={state}
    >
      {(close) => (
        <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
          {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
          <Field label="Nome do nível" name="name" required error={state.fieldErrors?.name}>
            {(p) => <Input {...p} defaultValue={v?.name ?? initial?.name} maxLength={60} autoFocus />}
          </Field>
          <Field
            label="Pontos mínimos"
            name="minPoints"
            required
            error={state.fieldErrors?.minPoints}
            hint={locked ? "O nível inicial sempre começa em 0." : "A ordem dos níveis segue os pontos mínimos."}
          >
            {(p) => (
              <Input {...p} type="number" min={0} defaultValue={v?.minPoints ?? initial?.minPoints ?? ""} readOnly={locked} />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="tonal" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </DialogButton>
  );
}

/** Criar ou editar uma conquista com critério automático. */
export function AchievementDialog({
  action,
  tracks,
  initial,
}: {
  action: Action;
  tracks: { id: string; title: string }[];
  initial?: {
    name: string;
    description: string;
    type: string;
    minimum: string;
    trackId: string;
    points: number;
    active: boolean;
  };
}) {
  const [state, formAction, pending] = useFormAction(action);
  useToastOnSuccess(state);
  const v = state.ok === false ? state.values : undefined;
  const [type, setType] = useState(v?.type ?? initial?.type ?? "CONTENTS_COMPLETED");
  return (
    <DialogButton
      label={initial ? "Editar" : "Nova conquista"}
      icon={initial ? <IconPencil /> : <IconPlus />}
      variant={initial ? "ghost" : "primary"}
      title={initial ? "Editar conquista" : "Nova conquista"}
      state={state}
    >
      {(close) => (
        <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
          {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
          <Field label="Nome" name="name" required error={state.fieldErrors?.name}>
            {(p) => <Input {...p} defaultValue={v?.name ?? initial?.name} maxLength={80} autoFocus />}
          </Field>
          <Field label="Descrição" name="description" required error={state.fieldErrors?.description}>
            {(p) => <Textarea {...p} defaultValue={v?.description ?? initial?.description} rows={2} maxLength={200} />}
          </Field>
          <Field label="Critério" name="type" required error={state.fieldErrors?.type}>
            {(p) => (
              <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(ACHIEVEMENT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {(type === "CONTENTS_COMPLETED" || type === "TRACKS_COMPLETED") && (
            <Field label="Quantidade" name="minimum" required error={state.fieldErrors?.minimum}>
              {(p) => <Input {...p} type="number" min={1} max={1000} defaultValue={v?.minimum ?? initial?.minimum ?? "1"} />}
            </Field>
          )}
          {type === "TRACK_COMPLETED" && (
            <Field label="Trilha" name="trackId" required error={state.fieldErrors?.trackId}>
              {(p) => (
                <Select {...p} defaultValue={v?.trackId ?? initial?.trackId ?? ""}>
                  <option value="">Escolha a trilha</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Pontos de bônus" name="points" error={state.fieldErrors?.points} hint="Use 0 para conquista sem bônus.">
            {(p) => <Input {...p} type="number" min={0} max={10000} defaultValue={v?.points ?? initial?.points ?? 0} />}
          </Field>
          <label className="flex items-center gap-3">
            <Checkbox name="active" defaultChecked={v ? v.active === "on" : (initial?.active ?? true)} />
            <span className="text-body text-ink">Ativa (passa a ser atribuída automaticamente)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="tonal" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </DialogButton>
  );
}

/** Ajuste manual de pontos (novo lançamento, com motivo). */
export function AdjustForm({ action, users }: { action: Action; users: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useFormAction(action);
  useToastOnSuccess(state);
  const v = state.ok === false ? state.values : undefined;
  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
      {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Pessoa" name="userId" required error={state.fieldErrors?.userId}>
        {(p) => (
          <Select {...p} defaultValue={v?.userId ?? ""}>
            <option value="">Escolha</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Pontos" name="points" required error={state.fieldErrors?.points} hint="Negativo para descontar.">
        {(p) => <Input {...p} type="number" defaultValue={v?.points} />}
      </Field>
      <Field label="Motivo" name="reason" required error={state.fieldErrors?.reason} hint="Fica no histórico e na auditoria.">
        {(p) => <Input {...p} defaultValue={v?.reason} maxLength={200} />}
      </Field>
      <div>
        <Button type="submit" variant="tonal" loading={pending}>
          Registrar ajuste
        </Button>
      </div>
    </form>
  );
}
